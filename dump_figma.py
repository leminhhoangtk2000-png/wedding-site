import json
import urllib.request

TOKEN = "figd_Mn7qqIvUAcig1l59EiyJeGn1HZjV5VSZGj5w0mZS"
FILE_KEY = "NoBTIbRYTmtPf1Z62Fex5A"
NODE_ID = "81-3"

url = f"https://api.figma.com/v1/files/{FILE_KEY}/nodes?ids={NODE_ID}&depth=6"
req = urllib.request.Request(url, headers={"X-Figma-Token": TOKEN})

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        with open('figma_dump.json', 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Dumped to figma_dump.json")
except Exception as e:
    print(f"Error: {e}")
