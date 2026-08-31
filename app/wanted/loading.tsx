import { CommitdexLoader } from "@/components/CommitdexLoader";

export default function WantedLoading() {
  return (
    <main className="route-loading">
      <CommitdexLoader
        label="routing the bounty wall"
        detail="loading wanted records · keeping the evidence intact"
      />
    </main>
  );
}
