import fetch from "node-fetch";

async function test() {
  const res = await fetch("http://localhost:5000/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "AI is transforming the world by improving efficiency and productivity."
    }),
  });

  const data = await res.json();
  console.log(data);
}

test();