import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const { createApp } = require('../server/app');
const { setupAdmin } = require('../server/db');
const dir = mkdtempSync(path.join(os.tmpdir(),'bosye-news-browser-'));
const {app,db} = createApp({dataDir:dir});
setupAdmin(db,'admin','NewsBrowser!123','测试管理员',false);
const server = await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(base+'/admin.html');
  await page.locator('[name=username]').fill('admin');
  await page.locator('[name=password]').fill('NewsBrowser!123');
  await page.getByRole('button',{name:'登录后台'}).click();
  await page.locator('[data-view=news]').click();
  await page.getByRole('button',{name:'添加品牌资讯'}).click();
  await page.locator('[name=title]').fill('博士园品牌资讯：关注毛发健康，了解品牌动态');
  await page.locator('[name=summary]').fill('这里是资讯摘要。后台发布的品牌动态将在此展示，持续分享博士园的品牌故事、服务信息与最新活动。');
  await page.locator('[name=body]').fill('## 品牌动态\n\n这是一篇用于验证发布流程的资讯。');
  await page.locator('[name=published]').check();
  await page.locator('#modalBody button[type=submit]').click();
  await page.locator('#modalBody').waitFor({state:'hidden'});
  await page.goto(base+'/news');
  assert.equal(await page.locator('.brand-news-card').count(),1);
  await page.screenshot({path:'test-results/news-desktop.png',fullPage:true});
  await page.locator('.brand-news-card').click();
  await page.getByRole('heading',{name:'品牌动态',exact:true}).waitFor();
  for (const width of [1440,1100,900,390]) {
    await page.setViewportSize({width,height:900});
    for (const route of ['/','/news']) {
      await page.goto(base+route);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), `overflow ${route} ${width}`);
    }
  }
  await page.screenshot({path:'test-results/news-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('品牌资讯后台添加发布、详情和桌面/手机布局检查通过');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});}
