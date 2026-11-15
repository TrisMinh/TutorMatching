import {test, expect} from '@playwright/test';

for (const role of ['Student', 'Tutor'] as const) {
  test(`${role} registers, verifies email and signs in without selecting a login role`, async ({page, request}) => {
    const email = `registration.ui.${Date.now()}.${role.toLowerCase()}@example.com`;
    const password = 'RegistrationUI!2026';
    await page.setViewportSize(role === 'Student' ? {width: 390, height: 844} : {width: 1440, height: 1000});
    await page.goto('/auth/sign-in');
    await expect(page.getByRole('button', {name: 'I’m a tutor'})).toHaveCount(0);
    await page.getByRole('link', {name: 'Sign up', exact: true}).click();
    await page.getByRole('button', {name: role === 'Tutor' ? 'I’m a tutor' : 'I’m a student'}).click();
    await page.getByLabel('Full name').fill(`New ${role}`);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', {exact: true}).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.screenshot({path: `../../../.logs/registration-${role.toLowerCase()}.png`, fullPage: true});
    await page.getByRole('button', {name: 'Create account'}).click();
    await expect(page).toHaveURL(/\/auth\/verify-email$/);
    await expect(page.getByLabel('Email address')).toHaveValue(email);
    const blocked = await request.post('/api/v1/auth/login', {data: {email, password}});
    expect(blocked.status()).toBe(403);
    expect((await blocked.json()).code).toBe('email_verification_required');
    const results = await (await request.get('http://localhost:8025/api/v1/search', {params: {query: 'to:' + email}})).json();
    const summary = results.messages.find((message: {Subject: string}) => message.Subject === 'Verify your TutorMatching email');
    expect(summary).toBeTruthy();
    const detail = await (await request.get('http://localhost:8025/api/v1/message/' + summary.ID)).json();
    const code = detail.Text.match(/verification code is: (\d{6})/)[1];
    const wrongCode = code === '000000' ? '111111' : '000000';
    for (let digit = 0; digit < 6; digit++) await page.getByLabel(`Verification digit ${digit + 1}`).fill(wrongCode[digit]);
    await page.getByRole('button', {name: 'Verify email', exact: true}).click();
    await expect(page.getByRole('alert').first()).toContainText('Invalid or expired');
    for (let digit = 0; digit < 6; digit++) await page.getByLabel(`Verification digit ${digit + 1}`).fill(code[digit]);
    await page.screenshot({path: `../../../.logs/verification-${role.toLowerCase()}.png`, fullPage: true});
    await page.getByRole('button', {name: 'Verify email', exact: true}).click();
    await expect(page.getByRole('status')).toContainText('Email verified successfully');
    await expect(page).toHaveURL(/\/auth\/verify-email$/);
    await expect(page.getByRole('button', {name: 'Email verified', exact: true})).toBeDisabled();
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    await expect(page.locator('.app-toast')).toHaveCount(0);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', {exact: true}).fill(password);
    await page.getByRole('button', {name: 'Log in', exact: true}).click();
    if (role === 'Student') {
      await expect(page).toHaveURL(/\/student\/dashboard$/);
      await expect(page.getByRole('heading',{name:'Welcome, New Student'})).toBeVisible();
      const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tutormatching.auth.session')!));
      const headers={Authorization:'Bearer '+session.accessToken};
      const profiles=await Promise.all(Array.from({length:4},()=>request.get('/api/v1/students/me',{headers})));
      for(const response of profiles)expect(response.status()).toBe(200);
      const profile=await profiles[0].json();
      expect(profile.displayName).toBe('New Student');expect(profile.educationLevel).toBe(-1);
      expect(profile.learningGoal).toBe('');expect(profile.interests).toEqual([]);
      for(const response of profiles)expect((await response.json()).id).toBe(profile.id);
      await page.goto('/student/complete-profile');
      await expect(page.getByLabel('Display name')).toHaveValue('New Student');
      await expect(page.getByLabel('Learning goal')).toHaveValue('');
      await page.getByRole('link',{name:'Do this later'}).click();
      await expect(page).toHaveURL(/\/student\/dashboard$/);
      await page.goto('/student/profile');
      await expect(page.getByLabel('Full name')).toHaveValue('New Student');
      await page.getByRole('button',{name:'Save changes'}).click();
      await expect(page.getByRole('status').filter({hasText:'Profile saved'}).first()).toBeVisible();
      const saved=await(await request.get('/api/v1/students/me',{headers})).json();
      expect(saved.educationLevel).toBe(-1);expect(saved.learningGoal).toBe('');
      await page.screenshot({path:'../../../.logs/optional-student-profile.png',fullPage:true});
    } else {
      await expect(page).toHaveURL(/\/tutor\/onboarding$/);
      await page.getByLabel('Display name').fill('New Tutor');
      await page.getByLabel('Bio').fill('A newly registered tutor completing a persisted profile.');
      await page.getByRole('button', {name: 'Save & continue', exact: true}).click();
      await expect(page).toHaveURL(/\/tutor\/subjects-pricing$/);
    }
    await page.goto('/' + role.toLowerCase() + '/dashboard');
    await expect(page).toHaveURL(new RegExp('/' + role.toLowerCase() + '/dashboard$'));
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('tutormatching.auth.session') ?? '{}'));
    expect(stored.role).toBe(role);
    if(role==='Tutor'){
      const headers={Authorization:'Bearer '+stored.accessToken};
      const settings=await (await request.get('/api/v1/users/me/settings',{headers})).json();
      expect((await request.put('/api/v1/users/me/settings',{headers,data:{...settings,profileVisible:false,emailReminders:false}})).ok()).toBeTruthy();
    }
  });
}
