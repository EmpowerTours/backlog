import type { Metadata } from "next";
import type { Address } from "viem";
import { Header } from "@/components/Header";
import { Portfolio } from "@/components/Portfolio";
import { ShareButton } from "@/components/ShareButton";
import { isAddress, shortAddr } from "@/lib/format";
import { BACKLOG_ADDRESS } from "@/lib/backlog";
import { explorerAddress } from "@/lib/chain";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  const who = isAddress(address) ? shortAddr(address) : "builder";
  return {
    title: `${who} · Backlog`,
    description: `${who}'s build portfolio — every project, scored and proven onchain on Monad.`,
  };
}

export default async function PublicPortfolio({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  if (!isAddress(address)) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-5 pb-24">
          <div className="panel mt-10 p-6">
            <div className="font-display font-semibold text-text">
              Not a valid address
            </div>
            <div className="mt-1 text-sm text-dim">
              Check the link and try again.
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-dim">
              Builder portfolio
            </div>
            <div className="mt-1 font-mono text-2xl text-text">
              {shortAddr(address)}
            </div>
            <a
              href={explorerAddress(BACKLOG_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              verified onchain · read live from Monad
            </a>
          </div>
          <ShareButton />
        </div>
        <Portfolio address={address as Address} owner={false} />
      </main>
    </>
  );
}
