import json
import urllib.request

TOKEN = "figd_Mn7qqIvUAcig1l59EiyJeGn1HZjV5VSZGj5w0mZS"
FILE_KEY = "NoBTIbRYTmtPf1Z62Fex5A"
NODE_ID = "81-3"

url = f"https://api.figma.com/v1/files/{FILE_KEY}/nodes?ids={NODE_ID}&depth=5"
req = urllib.request.Request(url, headers={"X-Figma-Token": TOKEN})

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        node = data['nodes']['81:3']['document']
        
        sections = []
        target_names = [
            "HS - Sân trường", "HS - Sân thượng", "HS - Hành lang",
            "TT - Sân trường", "TT - Lớp học", "TT - Cầu", "TT - Hồ",
            "Cưới - Rừng", "Cưới - Biển"
        ]
        
        def extract_text_style(text_node):
            style = text_node.get('style', {})
            return {
                'text': text_node.get('characters', ''),
                'fontSize': style.get('fontSize', 22),
                'fontFamily': style.get('fontFamily', 'Be Vietnam Pro'),
                'fontWeight': style.get('fontWeight', 400),
                'textAlign': style.get('textAlignHorizontal', 'LEFT'),
                'lineHeight': style.get('lineHeightPx', style.get('fontSize', 22) * 1.5)
            }
        
        def get_text_items(n, sec_x, sec_y, sec_w, sec_h):
            items = []
            if n.get('type') == 'TEXT':
                bbox = n.get('absoluteBoundingBox', {})
                if bbox:
                    cx = bbox.get('x', 0)
                    cy = bbox.get('y', 0)
                    cw = bbox.get('width', 0)
                    ch = bbox.get('height', 0)
                    
                    x_pct = round(((cx - sec_x) / sec_w) * 100, 2)
                    y_pct = round(((cy - sec_y) / sec_h) * 100, 4)
                    w_pct = round((cw / sec_w) * 100, 2)
                    h_pct = round((ch / sec_h) * 100, 4)
                    
                    items.append({
                        'type': 'text',
                        'x': x_pct, 'y': y_pct, 'w': w_pct, 'h': h_pct,
                        'textData': [extract_text_style(n)]
                    })
            else:
                for child in n.get('children', []):
                    items.extend(get_text_items(child, sec_x, sec_y, sec_w, sec_h))
            return items

        for i, child in enumerate(node.get('children', [])):
            cname = child.get('name', '')
            if cname in target_names and child.get('visible', True):
                bbox = child.get('absoluteBoundingBox', {})
                sec_x = bbox.get('x', 0)
                sec_y = bbox.get('y', 0)
                sec_w = bbox.get('width', 1280)
                sec_h = bbox.get('height', 1000)
                
                items = []
                
                def extract_elements(n):
                    fills = n.get('fills', [])
                    has_image = any(f.get('type') == 'IMAGE' for f in fills)
                    
                    if has_image:
                        name = n.get('name', '').split(' ')[0]
                        if not name.startswith('0000'):
                            name = n.get('name', '')
                        
                        bbox_n = n.get('absoluteBoundingBox', {})
                        if bbox_n:
                            lx = bbox_n.get('x', 0) - sec_x
                            ly = bbox_n.get('y', 0) - sec_y
                            x_pct = round((lx / sec_w) * 100, 2)
                            y_pct = round((ly / sec_h) * 100, 4)
                            w_pct = round((bbox_n.get('width', 0) / sec_w) * 100, 2)
                            h_pct = round((bbox_n.get('height', 0) / sec_h) * 100, 4)
                            
                            # Extract rotation
                            import math
                            transform = n.get('relativeTransform', None)
                            if transform:
                                cos_val = transform[0][0]
                                sin_val = transform[1][0]
                                angle = round(math.degrees(math.atan2(sin_val, cos_val)))
                            else:
                                angle = round(math.degrees(n.get('rotation', 0)))

                            items.append({
                                'type': 'image',
                                'x': x_pct, 'y': y_pct, 'w': w_pct, 'h': h_pct,
                                'rotation': angle,
                                'src': f'/images/{name}.jpg'
                            })
                    else:
                        if n.get('type') == 'TEXT':
                            items.extend(get_text_items(n, sec_x, sec_y, sec_w, sec_h))
                        else:
                            for c in n.get('children', []):
                                extract_elements(c)

                for c in child.get('children', []):
                    extract_elements(c)
                
                sections.append({
                    'id': f'section-{i}',
                    'name': cname,
                    'width': sec_w,
                    'height': sec_h,
                    'items': items
                })
        
        with open('src/lib/storyData.js', 'r', encoding='utf-8') as f:
            content = f.read()
            
        start_idx = content.find('export const gallerySections = [')
        if start_idx != -1:
            new_content = content[:start_idx] + 'export const gallerySections = ' + json.dumps(sections, ensure_ascii=False, indent=2) + ';\n'
            with open('src/lib/storyData.js', 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Successfully updated storyData.js with missing text elements")
        else:
            print("Could not find gallerySections in storyData.js")

except Exception as e:
    import traceback
    traceback.print_exc()
