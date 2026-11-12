from pathlib import Path
from PIL import Image
import json

def make_preview(source,dest,compact=False):
    im=Image.open(source).convert('RGB')
    if compact:
        # Collapse only nearly empty rows in non-quantitative layouts.
        # Dark lettering, arrow paths and colored strokes must all survive.
        pixels=im.load();active=[]
        for y in range(im.height):
            n=0
            for x in range(im.width):
                rgb=pixels[x,y]
                if min(rgb)<165 or (max(rgb)-min(rgb)>40 and min(rgb)<220):
                    n+=1
                    if n>=3:break
            active.append(n>=3)
        ranges=[];start=0;y=0
        while y<im.height:
            if active[y]:y+=1;continue
            end=y
            while end<im.height and not active[end]:end+=1
            if end-y>90:
                cut_start=y+20;cut_end=end-20
                ranges.append((start,cut_start));start=cut_end
            y=end
        ranges.append((start,im.height))
        total=sum(b-a for a,b in ranges)
        result=Image.new('RGB',(im.width,total),'white');offset=0
        for a,b in ranges:
            result.paste(im.crop((0,a,im.width,b)),(0,offset));offset+=b-a
        im=result
    im.thumbnail((760,420),Image.Resampling.LANCZOS)
    im.save(dest,optimize=True)
    return im.size

if __name__=='__main__':
    root=Path(__file__).resolve().parent
    for item in json.loads((root/'figures.json').read_text()):
        slug=item['slug']
        size=make_preview(root/f'{slug}.png',root/f'{slug}-inline.png',item['type'] in ['architecture','workflow'])
        print(slug,size)
