import { createRequire } from 'node:module';
import { join } from 'node:path';
import { mkdir,writeFile } from 'node:fs/promises';
import {root,out} from '../paths.mjs';
import {STARTERS} from '../characters/catalog.mjs';
const require=createRequire(join(root,'package.json')),{chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  await mkdir(join(out,'characters'),{recursive:true});
  const page=await browser.newPage({viewport:{width:1500,height:1000}});
  await page.goto(process.env.CHARACTER_URL||'http://127.0.0.1:4194/characters');
  await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:90000});
  for(const {id} of STARTERS){
    const data=await page.evaluate(async id=>{await window.characterStudio.select(id);return window.characterStudio.preview.capture();},id);
    await writeFile(join(out,`characters/${id}-base.png`),Buffer.from(data.split(',')[1],'base64'));
  }
  console.log(`Captured ${STARTERS.length} default reference portraits from the actual crew rigs.`);
}finally{await browser.close();}
