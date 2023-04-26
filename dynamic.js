/*

Dynamically lookup MX records and return a valid MTA-STS policy with a Cloudflare worker.

This allows multiple domains and subdomains to be served from one worker script.

Instructions:

    - Change mtaPolicy variable below if required
    - Add this worker script to Cloudflare

The below will need to be added for each Cloudflare DNS domain you want to serve MTA-STS policy for:

    - Create AAAA record mta-sts.yourdomain.com pointing to 100::
    - Create a worker route for https://mta-sts.yourdomain.com/.well-known/mta-sts.txt
    - Create _mta-sts TXT record to enable MTA-STS - Example: TXT IN _mta-sts "v=STSv1; id=1234567890"

*/

// Change MTA-STS policy template max age, mode: enforce/testing.
const mtaPolicy = 
`version: STSv1
mode: enforce
max_age: 1209600\n`;
// MX records will be automatically looked up and added

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const fullDomain = url.host;

  const domainParts = fullDomain.split('.');
  const domain = domainParts.length > 2 ? domainParts.slice(+1).join('.') : fullDomain;

  const dnsQueryUrl = `https://1.1.1.1/dns-query?name=${domain}&type=MX`;

  const fetchOptions = {
    method: 'GET',
    headers: {
      'Accept': 'application/dns-json'
    }
  };

  const dnsResponse = await fetch(dnsQueryUrl, fetchOptions);
  const dnsResponseJson = await dnsResponse.json();

  let responseText = '';

  if (dnsResponseJson.Status === 0) {
    if (dnsResponseJson.Answer) {
      const mxRecords = dnsResponseJson.Answer.filter(record => record.type === 15);

      if (mxRecords.length > 0) {
        responseText = (mtaPolicy)

        mxRecords.forEach(record => {
          const data = record.data.split(' ');
          const preference = data[0];
          const exchange = data[1];
          const exchangeWithoutFullStop = exchange.slice(0, -1);
          responseText += `mx: ${exchangeWithoutFullStop}\n`;
        });
      } else {
        responseText = 'No MX records found for ' + domain;
      }
    } else {
      responseText = 'No MX records found for ' + domain;
    }
  } else {
    responseText = 'Error while fetching MX records for ' + domain;
  }

  return new Response(responseText, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
