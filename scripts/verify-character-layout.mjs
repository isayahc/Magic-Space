import {createRequire} from 'node:module';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {root,out} from '../paths.mjs';
const {chromium,expect}=createRequire(join(root,'package.json'))('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[],errors=[];
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.CHARACTER_URL||'http://127.0.0.1:4194/characters');
  await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});
  await expect(page.locator('footer')).toHaveCount(0);
  const count=await page.evaluate(()=>window.characterStudio.characters().length);
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1280,720]]){
    await page.setViewportSize({width,height});
    for(const tab of ['Character','Loadout']){
      await page.getByRole('tab',{name:tab,exact:true}).click();
      const measure=await page.evaluate(()=>({page:[document.documentElement.clientHeight,document.documentElement.scrollHeight],editor:[document.querySelector('.editor').clientHeight,document.querySelector('.editor').scrollHeight],right:document.documentElement.scrollWidth,bottom:document.querySelector('#export-workflow').getBoundingClientRect().bottom,canvas:document.querySelector('#model-preview').getBoundingClientRect().height}));
      results.push({width,height,tab,...measure});
      expect(measure.page[1],`page overflow ${width}×${height} ${tab}`).toBeLessThanOrEqual(height);
      expect(measure.editor[1],`editor overflow ${width}×${height} ${tab}`).toBeLessThanOrEqual(measure.editor[0]+1);
      expect(measure.right).toBeLessThanOrEqual(width);expect(measure.bottom).toBeLessThanOrEqual(height);expect(measure.canvas).toBeGreaterThan(250);
    }
    await page.screenshot({path:join(out,`characters/viewport-${width}.png`)});
  }
  // Changing a saved-look selection is navigation, not an edit or a new draft.
  await page.locator('#outfit-select').selectOption('engineer');
  expect(await page.evaluate(()=>window.characterStudio.characters().length)).toBe(count);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('#outfit-list')).toBeVisible();
  await page.screenshot({path:join(out,'characters/viewport-mobile.png'),fullPage:true});
  expect(errors).toEqual([]);
  await writeFile(join(out,'characters/viewport-verification.json'),JSON.stringify({results,errors},null,2)+'\n');
  console.log('PASS: footer removed; page and editor fit four desktop viewports on both tabs; mobile remains accessible.');
}finally{await browser.close();}
