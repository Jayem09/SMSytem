package services

import (
	"context"
	"net/url"
	"testing"

	"smsystem-backend/internal/config"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestCacheServiceDisabledSkipsRedis(t *testing.T) {
	svc, err := NewCacheService(&config.Config{
		CacheEnabled: false,
		RedisHost:    "127.0.0.1",
		RedisPort:    "1",
	})
	if err != nil {
		t.Fatalf("expected disabled cache service without error, got %v", err)
	}
	if svc == nil {
		t.Fatal("expected cache service instance")
	}
	if svc.Enabled() {
		t.Fatal("expected cache service to be disabled")
	}

	ctx := context.Background()
	var target map[string]any
	found, err := svc.GetJSON(ctx, "missing", &target)
	if err != nil {
		t.Fatalf("expected disabled GetJSON to skip redis, got %v", err)
	}
	if found {
		t.Fatal("expected disabled GetJSON to report cache miss")
	}

	if err := svc.SetJSON(ctx, "key", map[string]string{"ok": "true"}, 0); err != nil {
		t.Fatalf("expected disabled SetJSON to skip redis, got %v", err)
	}

	if err := svc.DeleteByPrefixes(ctx, ProductListPrefix); err != nil {
		t.Fatalf("expected disabled DeleteByPrefixes to skip redis, got %v", err)
	}
}

func TestBuildScopedKeyNormalizesQueryOrder(t *testing.T) {
	values := url.Values{}
	values.Add("search", "milk tea")
	values.Add("status", "active")
	values.Add("status", "pending")
	values.Add("page", "2")

	got := BuildScopedListKey(ProductListPrefix, 7, "manager", values)
	want := "products:list:7:manager:page=2&search=milk+tea&status=active&status=pending"
	if got != want {
		t.Fatalf("expected normalized key %q, got %q", want, got)
	}
}

func TestDeleteByPrefixesRemovesMatchingKeys(t *testing.T) {
	mini := miniredis.RunT(t)

	client := redis.NewClient(&redis.Options{Addr: mini.Addr()})
	defer client.Close()

	ctx := context.Background()
	if err := client.Set(ctx, DashboardPrefix+"1:admin:page=1", `{\"count\":1}`, 0).Err(); err != nil {
		t.Fatalf("seed dashboard key: %v", err)
	}
	if err := client.Set(ctx, ProductListPrefix+"1:admin:page=1", `{\"count\":2}`, 0).Err(); err != nil {
		t.Fatalf("seed product key: %v", err)
	}
	if err := client.Set(ctx, CustomerListPrefix+"1:admin:page=1", `{\"count\":3}`, 0).Err(); err != nil {
		t.Fatalf("seed customer key: %v", err)
	}

	svc := &CacheService{client: client, enabled: true}
	if err := svc.DeleteByPrefixes(ctx, DashboardPrefix, ProductListPrefix); err != nil {
		t.Fatalf("delete by prefixes: %v", err)
	}

	if mini.Exists(DashboardPrefix + "1:admin:page=1") {
		t.Fatal("expected dashboard key to be deleted")
	}
	if mini.Exists(ProductListPrefix + "1:admin:page=1") {
		t.Fatal("expected product key to be deleted")
	}
	if !mini.Exists(CustomerListPrefix + "1:admin:page=1") {
		t.Fatal("expected customer key to remain")
	}
}
