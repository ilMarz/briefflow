import { test,expect } from '@playwright/test';

// These tests need no Jev key and no database: they never start a run.
test('public site: services, request dialog with required email, no internal graph',async({page},testInfo)=>{
 const posts:string[]=[]; page.on('request',r=>{if(r.method()==='POST')posts.push(r.url())});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.getByRole('heading',{level:1})).toContainText('Raccontaci cosa ti serve');
 await expect(page.getByRole('heading',{name:'Di cosa ci occupiamo'})).toBeVisible();
 await expect(page.locator('.graph-node')).toHaveCount(0);
 await page.getByRole('button',{name:'Invia una richiesta'}).first().click();
 const dialog=page.getByRole('dialog',{name:'Invia una richiesta'});
 await expect(dialog).toBeVisible();
 const email=dialog.getByLabel('Email');
 await expect(email).toHaveAttribute('type','email');
 await expect(email).toHaveAttribute('required','');
 await expect(dialog.getByRole('note')).toContainText('solo una simulazione');
 await expect(dialog.getByRole('note')).toContainText('SMTP');
 await expect(dialog.getByRole('link',{name:'backoffice'})).toHaveAttribute('href','/backoffice');
 await expect(email).toHaveValue('cliente.test@example.com');
 const send=dialog.getByRole('button',{name:'Invia richiesta'});
 await dialog.getByLabel('Di cosa hai bisogno?').fill('corto');
 await expect(send).toBeDisabled();
 await dialog.getByLabel('Di cosa hai bisogno?').fill('Ci serve un portale per i tecnici sul campo.');
 await expect(send).toBeEnabled();
 await email.fill('');
 await expect(send).toBeDisabled();
 await email.fill('non-valida');
 await expect(send).toBeDisabled();
 await email.fill('nome@azienda.it');
 await expect(send).toBeEnabled();
 await dialog.getByRole('button',{name:'Annulla'}).click();
 await expect(dialog).toBeHidden();
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',await page.locator('body').evaluate(e=>e.clientWidth));
 await page.screenshot({path:`artifacts/${testInfo.project.name}-site.png`,fullPage:true});
 const login=page.getByRole('link',{name:'Accedi al backoffice'});
 await expect(login).toBeVisible();
 await expect(login).toHaveAttribute('href','/backoffice');
 await page.getByRole('link',{name:'Area azienda'}).click();
 await expect(page).toHaveURL(/\/backoffice$/);
 expect(posts).toEqual([]);expect(errors).toEqual([]);
});

test('backoffice: graph, simulate-request dialog, profile dialog and presentation mode',async({page},testInfo)=>{
 const posts:string[]=[]; page.on('request',r=>{if(r.method()==='POST')posts.push(r.url())});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/backoffice');
 await expect(page.getByRole('heading',{level:1})).toContainText('Backoffice');
 expect(await page.locator('.graph-node').count()).toBe(9);
 await expect(page.getByRole('link',{name:/sito pubblico/i})).toHaveAttribute('href','/');
 await page.getByRole('button',{name:'Simula richiesta',exact:true}).first().click();
 await expect(page.getByRole('heading',{name:'Simula richiesta'})).toBeVisible();
 await expect(page.getByLabel('Brief di progetto')).toBeEditable();
 const email=page.getByLabel(/Email di contatto/);
 await expect(email).toHaveAttribute('type','email');
 await expect(email).toHaveAttribute('required','');
 await expect(email).toHaveValue('cliente.test@example.com');
 await page.getByLabel('Brief di progetto').fill('corto');
 await expect(page.getByRole('button',{name:'Qualifica richiesta'})).toBeDisabled();
 await page.getByRole('button',{name:'Annulla'}).click();
 await expect(page.getByRole('heading',{name:'Simula richiesta'})).toBeHidden();
 await page.getByRole('button',{name:/Profilo/}).click();
 await expect(page.getByRole('heading',{name:'Profilo aziendale'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('heading',{name:'Profilo aziendale'})).toBeHidden();
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',await page.locator('body').evaluate(e=>e.clientWidth));
 await page.screenshot({path:`artifacts/${testInfo.project.name}-final.png`,fullPage:true});
 await page.getByRole('button',{name:'Presenta',exact:true}).click();
 await expect(page.getByRole('button',{name:'Esci',exact:true})).toBeVisible();
 await page.screenshot({path:`artifacts/${testInfo.project.name}-presentation.png`,fullPage:true});
 expect(posts).toEqual([]);expect(errors).toEqual([]);
});

test('backoffice: clicking a node opens its detail and Escape closes it',async({page},testInfo)=>{
 await page.goto('/backoffice');
 await expect(page.locator('.request-panel h2')).toHaveText('Richieste ricevute');
 if(testInfo.project.name==='mobile'){
  await page.locator('.mobile-flow-node').first().click();
 } else {
  await page.locator('.react-flow__node[data-id="classify"]').click();
 }
 const detail=page.getByRole('dialog',{name:/Dettaglio/});
 await expect(detail).toBeVisible();
 await expect(detail.getByRole('tab',{name:'Output'})).toBeVisible();
 await expect(detail.getByText('Durata ultima visita')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(detail).toBeHidden();
});

test('config exposes no credentials and the removed demo endpoint is gone',async({request})=>{
 const config=await request.get('/api/config');expect(config.ok()).toBeTruthy();
 expect(Object.keys(await config.json()).sort()).toEqual(['limitReached','liveAvailable','mailAvailable']);
 expect((await request.get('/api/demos')).status()).toBe(404);
});

test('reduced motion keeps the backoffice graph readable',async({page},testInfo)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/backoffice');
 expect(await page.locator('.graph-node').count()).toBe(9);
 await page.screenshot({path:`artifacts/${testInfo.project.name}-reduced-motion.png`,fullPage:true});
});
