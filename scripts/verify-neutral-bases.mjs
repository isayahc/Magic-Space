// Verify the rebuilt bases and capture their actual animated meshes as portraits.
// No model/provider calls; run against the local website after installing assets.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,out} from '../paths.mjs';
const {chromium,expect}=createRequire(join(root,'package.json'))('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
const scientists=process.argv.includes('--scientists');
const people=scientists?[['astrophysicist','Aster'],['materials-scientist','Flint']]:[['astronaut','Kite'],['botanist','Pip']];
const folder=scientists?'scientists':'neutral-bases';
const evidence={},errors=[];
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).hostname==='127.0.0.1')errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(process.env.CHARACTER_URL||'http://127.0.0.1:4194/characters');
  await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});
  for(const [id] of people){
    await page.evaluate(id=>window.characterStudio.select(id),id);
    await page.getByRole('button',{name:'Walk',exact:true}).click();
    const before=await page.evaluate(()=>window.characterStudio.preview.snapshot());
    await page.evaluate(async()=>{for(let i=0;i<24;i++)await new Promise(requestAnimationFrame);});
    const after=await page.evaluate(()=>window.characterStudio.preview.snapshot());
    expect(after.skins).toBeGreaterThan(0);expect(after.bone).not.toEqual(before.bone);
    expect(after.loadedURL).toContain(`${id}-walk.glb`);
    await page.getByRole('button',{name:'Idle',exact:true}).click();
    await page.evaluate(async()=>{for(let i=0;i<24;i++)await new Promise(requestAnimationFrame);});
    const portrait=await page.evaluate(()=>window.characterStudio.preview.capture());
    await writeFile(join(out,`characters/${id}-base.png`),Buffer.from(portrait.split(',')[1],'base64'));
    evidence[id]={before,after,portrait:`${id}-base.png`};
  }
  await page.reload();await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});
  for(const [id,name] of people){
    await page.getByRole('button',{name:`Select ${name}`,exact:true}).click();
    await expect(page.locator('#character-name')).toHaveText(name);
    await expect(page.locator('#stage-loading')).toBeHidden({timeout:90000});
    expect((await page.evaluate(()=>window.characterStudio.preview.snapshot())).loadedURL).toContain(`${id}-walk.glb`);
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    expect(await page.locator('#base-thumb').evaluate(img=>img.complete&&img.naturalWidth>500)).toBe(true);
    await page.screenshot({path:join(out,`characters/${folder}/${id}-studio.png`)});
    // Orbit half a turn to inspect coverage on the back of the generated mesh.
    const canvas=await page.locator('#model-preview canvas').boundingBox();
    await page.mouse.move(canvas.x+canvas.width*.25,canvas.y+canvas.height*.5);
    await page.mouse.down();
    await page.mouse.move(canvas.x+canvas.width*.25+canvas.height*.5,canvas.y+canvas.height*.5,{steps:30});
    await page.mouse.up();
    await page.evaluate(async()=>{for(let i=0;i<60;i++)await new Promise(requestAnimationFrame);});
    await page.screenshot({path:join(out,`characters/${folder}/${id}-rear.png`)});
    await page.evaluate(()=>window.characterStudio.preview.reset());
  }
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:join(out,`characters/${folder}/mobile.png`),fullPage:true});
  expect(errors).toEqual([]);
  await writeFile(join(out,`characters/${folder}/verification.json`),JSON.stringify({checks:['two skinned meshes','changing walk bone transforms','idle portraits rendered from actual rigs','updated base thumbnails','front/rear coverage captures','desktop/mobile'],evidence,errors},null,2)+'\n');
  console.log(`PASS: ${people.map(p=>p[1]).join(' and ')} rigs, moving bones, base portraits and desktop/mobile previews.`);
}finally{await browser.close();}
