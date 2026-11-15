import type {APIRequestContext} from '@playwright/test';

export async function verifyEmail(request: APIRequestContext, email: string) {
  const search = await request.get('http://localhost:8025/api/v1/search', {params: {query: 'to:' + email}});
  const messages = (await search.json()).messages;
  const summary = messages.find((message: {Subject: string}) => message.Subject === 'Verify your TutorMatching email');
  if (!summary) throw new Error('Verification tests require Identity to use Mailpit.');
  const detail = await (await request.get('http://localhost:8025/api/v1/message/' + summary.ID)).json();
  const code = detail.Text.match(/verification code is: (\d{6})/)[1];
  const result = await request.post('http://localhost:8080/api/v1/auth/verify-email', {data: {email, code}});
  if (!result.ok()) throw new Error('Email verification failed in fixture setup.');
}
