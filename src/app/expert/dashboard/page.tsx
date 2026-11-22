import type { Metadata } from "next";
import { Clock, HeartPulse, ShieldCheck } from "lucide-react";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page";
import { ActionForm, SubmitButton, TextAreaField } from "@/components/forms/action-form";
import { requirePageRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";
import { expertStatus, listReviewQueue } from "@/server/experts/service";
import { submitExpertReviewAction } from "@/server/actions/ai";
import type { CropHealthResult } from "@/server/ai/prompts";

export const metadata: Metadata = { title: "Expert reviews" };

type Case = Awaited<ReturnType<typeof listReviewQueue>>["open"][number];

function CaseCard({ c, answerable }: { c: Case; answerable: boolean }) {
  const r = (c.result ?? null) as Partial<CropHealthResult> | null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {c.crop.name}
          {c.possibleIssue && <span className="font-normal text-navy-600">· AI: {c.possibleIssue}</span>}
          {c.confidence && <Badge tone="slate">{c.confidence.toLowerCase()} confidence</Badge>}
        </CardTitle>
        <p className="text-xs text-navy-500">
          {c.farm ? `${c.farm.district}, ${c.farm.province.replace("_", " ").toLowerCase()} · ` : ""}
          {c.reviewRequestedAt ? `requested ${formatDateTime(c.reviewRequestedAt)}` : formatDateTime(c.createdAt)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {c.imageId && (
          // eslint-disable-next-line @next/next/no-img-element -- private, authorised image
          <img src={`/api/uploads/${c.imageId}`} alt={`Farmer's photo of ${c.crop.name}`} className="max-h-72 w-full rounded-xl object-cover" loading="lazy" />
        )}
        <div>
          <p className="font-semibold">Farmer&apos;s description</p>
          <p className="whitespace-pre-line text-navy-700">{c.symptoms}</p>
        </div>
        {r?.possible_causes?.length ? (
          <div>
            <p className="font-semibold">AI possible causes</p>
            <ul className="list-disc pl-5 text-navy-700">
              {r.possible_causes.map((p, i) => (
                <li key={i}>
                  {p.name} ({p.likelihood.toLowerCase()})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {answerable ? (
          <ActionForm action={submitExpertReviewAction.bind(null, c.id)} className="space-y-2" resetOnSuccess>
            <TextAreaField name="note" label="Your second opinion" rows={5} required hint="What you think it is, how sure you are, and what the farmer should do next." />
            <SubmitButton>Send to farmer</SubmitButton>
          </ActionForm>
        ) : (
          c.expertNote && (
            <div className="rounded-xl bg-forest-50 p-3">
              <p className="font-semibold text-forest-800">Your review</p>
              <p className="whitespace-pre-line">{c.expertNote}</p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

export default async function ExpertDashboard() {
  const user = await requirePageRole("EXPERT");
  const actor = { id: user.id, role: user.role };
  const status = await expertStatus(actor);
  const queue = status.verified ? await listReviewQueue(actor) : null;
  return (
    <>
      <PageHeader title="Crop-health reviews" description="Farmers send AI crop-health checks here when they want a human second opinion. You see the photo, crop, symptoms and district — never the farmer&apos;s name or contacts." />
      {!status.verified ? (
        <Alert tone="amber" icon={<Clock />} title="Waiting for verification">
          An administrator needs to verify your expert account before cases are shown to you. This protects farmers&apos; data.
        </Alert>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <HeartPulse className="size-5 text-forest-600" /> Open cases ({queue!.open.length})
            </h2>
            {queue!.open.length === 0 ? <p className="text-sm text-navy-500">No cases are waiting right now.</p> : <div className="grid gap-4 lg:grid-cols-2">{queue!.open.map((c) => <CaseCard key={c.id} c={c} answerable />)}</div>}
          </section>
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="size-5 text-forest-600" /> Your answered cases ({queue!.answered.length})
            </h2>
            {queue!.answered.length === 0 ? <p className="text-sm text-navy-500">You have not answered any cases yet.</p> : <div className="grid gap-4 lg:grid-cols-2">{queue!.answered.map((c) => <CaseCard key={c.id} c={c} answerable={false} />)}</div>}
          </section>
        </div>
      )}
    </>
  );
}
