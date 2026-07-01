import urllib.request
import json
import os

TOKEN = "figd_Mn7qqIvUAcig1l59EiyJeGn1HZjV5VSZGj5w0mZS"
FILE_KEY = "NoBTIbRYTmtPf1Z62Fex5A"
NODE_ID = "81:458" # Figma uses colon for node ids in API

url = f"https://api.figma.com/v1/images/{FILE_KEY}?ids={NODE_ID}&format=svg"
req = urllib.request.Request(url, headers={"X-Figma-Token": TOKEN})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read())
        img_url = data['images'][NODE_ID]
        print(f"SVG URL: {img_url}")
        
        # Download and save
        if img_url:
            urllib.request.urlretrieve(img_url, "public/images/logo.svg")
            print("Logo saved successfully.")
except Exception as e:
    print(f"Error: {e}")
