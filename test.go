package main

import (
"fmt"
"io/ioutil"
"net/http"
)

func main() {
	resp, err := http.Get("http://localhost:8080/api/customers/crm-stats")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Println(string(body))
}
