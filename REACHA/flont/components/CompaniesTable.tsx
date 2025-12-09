"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiDelete, apiGet, ResultsResponse } from '../lib/api';

type CompanyWithProposal = {
  name: string;
  hasProposal: boolean;
  loading: boolean;
};

export default function CompaniesTable({ companies }: { companies: string[] }) {
  const [list, setList] = useState<string[]>(companies || []);
  const [companyProposals, setCompanyProposals] = useState<Map<string, boolean>>(new Map());

  // 親からの更新を反映
  useEffect(() => {
    setList(companies || []);
  }, [companies]);

  // 各会社の提案の存在を確認
  useEffect(() => {
    const checkProposals = async () => {
      const proposals = new Map<string, boolean>();
      await Promise.all(
        list.map(async (company) => {
          try {
            const result = await apiGet<ResultsResponse>(`/api/results/${encodeURIComponent(company)}`);
            proposals.set(company, result.hasProposal || false);
          } catch {
            proposals.set(company, false);
          }
        })
      );
      setCompanyProposals(proposals);
    };
    if (list.length > 0) {
      checkProposals();
    }
  }, [list]);

  async function onDelete(name: string) {
    if (!confirm(`「${name}」の結果を削除します。よろしいですか？`)) return;
    try {
      await apiDelete(`/api/results/${encodeURIComponent(name)}`);
      // 再取得（存在すれば）
      try {
        const r = await apiGet<{ companies: string[] }>(`/api/companies`);
        setList(r.companies);
      } catch {
        setList((prev) => prev.filter((x) => x !== name));
      }
    } catch (e) {
      alert('削除に失敗しました');
    }
  }

  if (!list?.length) {
    return <p className="muted">過去の結果はまだありません。</p>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>会社名</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {list.map((c) => {
          const hasProposal = companyProposals.get(c) || false;
          return (
            <tr key={c}>
              <td>{c}</td>
              <td style={{ display: 'flex', gap: 8 }}>
                <Link className="btn btn-ghost" href={`/company/${encodeURIComponent(c)}`}>
                  会社情報を開く
                </Link>
                {hasProposal ? (
                  <Link 
                    className="btn btn-ghost" 
                    href={`/company/${encodeURIComponent(c)}/proposal`}
                  >
                    提案結果を開く
                  </Link>
                ) : (
                  <button 
                    className="btn btn-ghost" 
                    disabled
                    style={{ opacity: 0.5, cursor: 'not-allowed' }}
                    title="提案がまだ作成されていません"
                  >
                    提案結果を開く
                  </button>
                )}
                <button className="btn btn-danger" onClick={() => onDelete(c)}>削除</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}


