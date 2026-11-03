import { createRequire } from 'node:module';
import { join } from 'node:path';
import { rename, rmdir } from 'node:fs/promises';
import { root,out } from '../paths.mjs';
const require=createRequire(join(root,'package.json'));
const { chromium,expect }=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:join(out,'station/capture'),size:{width:1280,height:800}}});
  const page=await context.newPage();
  await page.goto(process.env.STATION_URL||'http://127.0.0.1:4194/station');
  await expect(page.locator('body')).toHaveAttribute('data-ready','true',{timeout:120000});
  await page.evaluate(()=>window.station.advance(12));
  await page.getByRole('button',{name:'Crew view'}).click();
  // Capture twelve seconds of real-time playback, rather than screenshots of teleported poses.
  await page.waitForTimeout(12000);
  await context.close();
  await rename(await page.video().path(),join(out,'station/crew-walking.webm'));
  await rmdir(join(out,'station/capture'));
  console.log('Saved assets/station/crew-walking.webm');
}finally{await browser.close();}
