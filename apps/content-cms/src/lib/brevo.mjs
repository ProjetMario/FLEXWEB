export function createBrevoDelivery({ fetcher = fetch, getSecrets = () => process.env } = {}) {
  return async ({ message }) => {
    const secrets = getSecrets();
    if (!secrets.BREVO_API_KEY || !secrets.FLEXWEB_MAIL_FROM) throw new Error('BREVO_NOT_CONFIGURED');
    const address = (value) => typeof value === 'string' ? { email: value } : value;
    const recipients = Array.isArray(message.to) ? message.to.map(address) : [address(message.to)];
    const payload = { sender: { email: secrets.FLEXWEB_MAIL_FROM, name: 'Flex-Web — contenus' }, to: recipients, subject: message.subject, textContent: message.text, ...(message.html ? { htmlContent: message.html } : {}), ...(message.replyTo ? { replyTo: address(message.replyTo) } : {}) };
    const response = await fetcher('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': secrets.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`BREVO_SEND_FAILED_${response.status}`);
    // API acceptance is not a delivered/read confirmation. Native EmDash manages the login token.
  };
}
