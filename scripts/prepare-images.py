from pathlib import Path
from PIL import Image, ImageOps
import json
ROOT=Path(__file__).resolve().parents[1]
records=[]
def save(source,target,box=None,size=(1600,1200),label=''):
 im=Image.open(ROOT/source).convert('RGB')
 if box:im=im.crop(box)
 im.thumbnail(size,Image.Resampling.LANCZOS)
 im.save(ROOT/'assets'/target,'WEBP',quality=88,method=6)
 records.append({'source':source,'output':'assets/'+target,'crop':box,'dimensions':list(im.size),'label':label})
for n,label in [(2,'门店外观设计'),(3,'独立护理空间'),(4,'接待与产品展示区'),(5,'洗护空间'),(6,'开放护理空间'),(7,'头皮检测与咨询区')]:
 save(f'source-materials/knowledge/image{n}.jpeg',f'brand-space-{n}.webp',label=label)
save('assets/bosye-kyxin1.jpg','brand-founder.webp',(1080,0,1918,520),label='王朝刚博士')
save('assets/bosye-zflslb01.jpg','brand-laboratory.webp',(0,0,790,540),label='科研工作场景')
save('assets/bosye-kylb04.png','brand-products.webp',(0,0,800,500),label='博士园产品展示')
save('assets/bosye-kylb11.png','brand-campus.webp',(0,0,790,510),label='品牌园区历史资料')
save('assets/bosye-sxylb4.png','brand-training.webp',(0,0,940,570),label='门店人员培训')
for n in range(1,6):save(f'assets/bosye-fwlb{n}.jpg',f'brand-care-{n}.webp',size=(900,700),label='官网服务场景')
(ROOT/'source-materials'/'website'/'image-derivations.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
print('Prepared',len(records),'brand images')
