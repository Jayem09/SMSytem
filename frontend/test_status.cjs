async function testStatus() {
  try {
    const res = await fetch('http://168.144.46.137:8080/api/status');
    const data = await res.json();
    console.log("REMOTE API RESPONSE:");
    console.log(data);
  } catch (err) {
    console.log("Remote failed: " + err.message);
  }

  try {
    const res = await fetch('http://localhost:8080/api/status');
    const data = await res.json();
    console.log("LOCAL API RESPONSE:");
    console.log(data);
  } catch (err) {
    console.log("Local failed: " + err.message);
  }
}

testStatus();
