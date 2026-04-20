import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { EditorUsagePanel } from "../shared/EditorUsagePanel";
import { ItemBaseEditorContent } from "./ItemBaseEditorContent";
import { useInteractableStore } from "../../stores/interactableStore";
import { useItemizationStore } from "../../stores/itemizationStore";
import { ItemizationErrorBoundary } from "./ItemizationErrorBoundary";

export function ItemBaseEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { itemBases, uniqueItems } = useItemizationStore();
  const { interactables } = useInteractableStore();
  const itemBase = itemBases.find((entry) => entry.id === id);

  if (!itemBase) {
    return (
      <PageShell title="Item Base Not Found">
        <p>No item base with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/itemization/bases")}>
          Back to Item Bases
        </button>
      </PageShell>
    );
  }

  const uniqueReferences = uniqueItems
    .filter((entry) => entry.baseId === itemBase.id)
    .map((entry) => ({
      id: entry.id,
      label: entry.name,
      to: `/itemization/uniques/${entry.id}`,
      meta: "unique item",
    }));
  const lootReferences = interactables
    .filter((entry) =>
      entry.lootTable.some((loot) => loot.dropType === "item_base" && loot.itemBaseId === itemBase.id)
    )
    .map((entry) => ({
      id: entry.id,
      label: entry.name,
      to: `/interactables/${entry.id}`,
      meta: "loot table",
    }));

  return (
    <PageShell
      title={itemBase.name}
      actions={
        <button className="btn" onClick={() => navigate("/itemization/bases")}>
          Back to Item Bases
        </button>
      }
    >
      <EditorUsagePanel
        groups={[
          { label: "Unique Items", items: uniqueReferences },
          { label: "Loot Tables", items: lootReferences },
        ]}
      />
      <ItemizationErrorBoundary contextLabel={`item base ${itemBase.id}`}>
        <ItemBaseEditorContent itemBaseId={itemBase.id} />
      </ItemizationErrorBoundary>
    </PageShell>
  );
}
