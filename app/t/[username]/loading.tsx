import { CommitdexLoader } from "@/components/CommitdexLoader";

export default function TrainerLoading() {
  return (
    <main className="route-loading route-loading--dossier">
      <CommitdexLoader
        label="routing the trainer dossier"
        detail="retrieving the record · checking the latest pull"
      />
    </main>
  );
}
