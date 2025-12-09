import fs from 'fs';
import path from 'path';
import CompanyClient from './Client';

export const dynamic = 'error';

export function generateStaticParams() {
  const outputsDir = path.join(process.cwd(), '..', 'back', 'outputs');
  let companies: string[] = [];
  try {
    companies = fs
      .readdirSync(outputsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    companies = [];
  }
  return companies.map((company) => ({ company }));
}

export default function CompanyPage({ params }: { params: { company: string } }) {
  const company = decodeURIComponent(String(params.company));
  return <CompanyClient company={company} />;
}

