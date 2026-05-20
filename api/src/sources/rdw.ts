const RDW_BASE_URL = "https://opendata.rdw.nl/resource";

export async function fetchRdwDataset<T>(datasetId: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${RDW_BASE_URL}/${datasetId}.json`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: HeadersInit = {
    accept: "application/json"
  };

  if (process.env.RDW_APP_TOKEN) {
    headers["X-App-Token"] = process.env.RDW_APP_TOKEN;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`RDW ${datasetId} returned ${response.status}`);
  }

  return response.json() as Promise<T>;
}
