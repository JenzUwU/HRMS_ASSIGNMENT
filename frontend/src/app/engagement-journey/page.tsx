import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import {
  getCandidate,
  getCandidateCommunications,
  getCandidateDocuments,
  getCandidateNotes,
  getCandidateTasks,
  getCandidates,
  getEngagement,
} from "@/lib/api";
import { JourneyView } from "./JourneyView";

export default async function EngagementJourneyPage({
  searchParams,
}: PageProps<"/engagement-journey">) {
  const sp = await searchParams;
  const raw = sp.candidate;
  let slug = Array.isArray(raw) ? raw[0] : raw;

  // No candidate in the URL: default to the first candidate in the list.
  if (!slug) {
    try {
      const list = await getCandidates({ page: 1, page_size: 1 });
      slug = list.items[0]?.slug;
    } catch {
      slug = undefined;
    }
  }
  if (!slug) notFound();

  let data;
  try {
    const [candidate, engagement, communications, tasks, notes, documents] =
      await Promise.all([
        getCandidate(slug),
        getEngagement(slug),
        getCandidateCommunications(slug),
        getCandidateTasks(slug),
        getCandidateNotes(slug),
        getCandidateDocuments(slug),
      ]);
    data = { candidate, engagement, communications, tasks, notes, documents };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <JourneyView
      candidate={data.candidate}
      engagement={data.engagement}
      communications={data.communications}
      tasks={data.tasks}
      notes={data.notes}
      documents={data.documents}
    />
  );
}
