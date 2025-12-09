import ProposalClient from './Client';
import path from 'path';
import fs from 'fs';

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

export default function ProposalPage({ params }: { params: { company: string } }) {
  const company = decodeURIComponent(String(params.company));
  return <ProposalClient company={company} />;
}

