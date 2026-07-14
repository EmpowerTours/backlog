import type { Address } from "viem";
import { Header } from "@/components/Header";
import { Portfolio } from "@/components/Portfolio";
import { isAddress, shortAddr } from "@/lib/format";

export default async function PublicPortfolio({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-24">
        {isAddress(address) ? (
          <>
            <div className="pb-6 pt-4">
              <div className="text-xs uppercase tracking-widest text-dim">
                Builder
              </div>
              <div className="font-mono text-lg text-text">
                {shortAddr(address)}
              </div>
            </div>
            <Portfolio address={address as Address} owner={false} />
          </>
        ) : (
          <div className="panel mt-10 p-6">
            <div className="font-display font-semibold text-text">
              Not a valid address
            </div>
            <div className="mt-1 text-sm text-dim">
              Check the link and try again.
            </div>
          </div>
        )}
      </main>
    </>
  );
}
