import { useState } from "react";
import { useAdminMutations } from "./api";
import { useToast } from "../../components/ui/Toast";
import { PodcastForm, StoryForm, ChronicleForm } from "./components/CrudForms";
import RegionMetaForm from "./components/RegionMetaForm";

const TABS = [
  { id: "meta", label: "Регион" },
  { id: "podcasts", label: "Подкасты" },
  { id: "stories", label: "Истории" },
  { id: "chronicle", label: "Летопись" },
];

function RegionEditor({ region }) {
  const [tab, setTab] = useState("meta");
  const mutations = useAdminMutations();
  const addToast = useToast();
  const [editingId, setEditingId] = useState(null);

  function notify(promise, success = "Сохранено", failure = "Не удалось сохранить") {
    return promise
      .then(() => addToast(success, "success"))
      .catch((err) => {
        addToast(err?.message || failure, "error");
        throw err;
      });
  }

  return (
    <div className="istoki-admin-editor">
      <header className="istoki-admin-editor-head">
        <div>
          <div className="istoki-admin-editor-eyebrow">Регион</div>
          <h2 className="istoki-admin-editor-title">{region.name}</h2>
          <div className="istoki-admin-editor-hint">
            {region.geographicHint || region.isoCode || region.code}
          </div>
        </div>
      </header>

      <div className="istoki-admin-tabs" role="tablist">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            type="button"
            role="tab"
            aria-selected={tab === tabDef.id}
            className="istoki-admin-tab"
            onClick={() => {
              setTab(tabDef.id);
              setEditingId(null);
            }}
          >
            {tabDef.label}
          </button>
        ))}
      </div>

      <div className="istoki-admin-editor-body">
        {tab === "meta" && (
          <RegionMetaForm
            region={region}
            onSave={(payload) =>
              notify(mutations.updateRegion.mutateAsync({ ...payload, code: region.code }))
            }
          />
        )}

        {tab === "podcasts" && (
          <CrudList
            label="подкаст"
            items={region.podcasts}
            renderItemTitle={(p) => p.title}
            renderItemMeta={(p) =>
              `${p.recordedAt || ""}${p.speakerName ? " · " + p.speakerName : ""}`
            }
            editingId={editingId}
            setEditingId={setEditingId}
            onCreate={(payload) =>
              notify(mutations.createPodcast.mutateAsync({ regionCode: region.code, ...payload }))
            }
            onUpdate={(id, payload) =>
              notify(
                mutations.updatePodcast.mutateAsync({
                  id,
                  regionCode: region.code,
                  ...payload,
                }),
              )
            }
            onDelete={(id) =>
              notify(
                mutations.deletePodcast.mutateAsync({ id, regionCode: region.code }),
                "Удалено",
                "Не удалось удалить",
              )
            }
            FormComponent={PodcastForm}
            emptyTemplate={{
              title: "",
              description: "",
              audioUrl: "",
              durationSec: 0,
              recordedAt: "",
              speakerName: "",
              orderIdx: region.podcasts.length,
            }}
          />
        )}

        {tab === "stories" && (
          <CrudList
            label="историю"
            items={region.stories}
            renderItemTitle={(s) => s.participantName}
            renderItemMeta={(s) => s.ageOrRole}
            editingId={editingId}
            setEditingId={setEditingId}
            onCreate={(payload) =>
              notify(mutations.createStory.mutateAsync({ regionCode: region.code, ...payload }))
            }
            onUpdate={(id, payload) =>
              notify(
                mutations.updateStory.mutateAsync({
                  id,
                  regionCode: region.code,
                  ...payload,
                }),
              )
            }
            onDelete={(id) =>
              notify(
                mutations.deleteStory.mutateAsync({ id, regionCode: region.code }),
                "Удалено",
                "Не удалось удалить",
              )
            }
            FormComponent={StoryForm}
            emptyTemplate={{
              participantName: "",
              ageOrRole: "",
              beforeText: "",
              afterText: "",
              manifestoQuote: "",
              photoUrl: "",
              regionContextHint: "",
              orderIdx: region.stories.length,
            }}
          />
        )}

        {tab === "chronicle" && (
          <CrudList
            label="событие"
            items={region.chronicle}
            renderItemTitle={(c) => c.eventTitle}
            renderItemMeta={(c) => `${c.eventDate} · ${c.participantsCount} участников`}
            editingId={editingId}
            setEditingId={setEditingId}
            onCreate={(payload) =>
              notify(mutations.createChronicle.mutateAsync({ regionCode: region.code, ...payload }))
            }
            onUpdate={(id, payload) =>
              notify(
                mutations.updateChronicle.mutateAsync({
                  id,
                  regionCode: region.code,
                  ...payload,
                }),
              )
            }
            onDelete={(id) =>
              notify(
                mutations.deleteChronicle.mutateAsync({ id, regionCode: region.code }),
                "Удалено",
                "Не удалось удалить",
              )
            }
            FormComponent={ChronicleForm}
            emptyTemplate={{
              eventDate: "",
              eventTitle: "",
              participantsCount: 0,
              keyInsights: [],
              orderIdx: region.chronicle.length,
            }}
          />
        )}
      </div>
    </div>
  );
}

function CrudList({
  label,
  items,
  renderItemTitle,
  renderItemMeta,
  editingId,
  setEditingId,
  onCreate,
  onUpdate,
  onDelete,
  FormComponent,
  emptyTemplate,
}) {
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <FormComponent
        initial={emptyTemplate}
        onSubmit={async (payload) => {
          await onCreate(payload);
          setCreating(false);
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (editingId) {
    const item = items.find((i) => i.id === editingId);
    if (!item) {
      setEditingId(null);
      return null;
    }
    return (
      <FormComponent
        initial={item}
        onSubmit={async (payload) => {
          await onUpdate(editingId, payload);
          setEditingId(null);
        }}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="istoki-admin-list">
      <div className="istoki-admin-list-head">
        <span className="istoki-admin-list-count">
          Всего: <strong>{items.length}</strong>
        </span>
        <button
          type="button"
          className="istoki-admin-button is-primary"
          onClick={() => setCreating(true)}
        >
          Добавить {label}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="istoki-admin-empty">Нет записей. Добавьте первую.</div>
      ) : (
        <ul className="istoki-admin-list-items">
          {items.map((item) => (
            <li key={item.id} className="istoki-admin-list-item">
              <div className="istoki-admin-list-item-info">
                <div className="istoki-admin-list-item-title">{renderItemTitle(item)}</div>
                <div className="istoki-admin-list-item-meta">{renderItemMeta(item)}</div>
              </div>
              <div className="istoki-admin-list-item-actions">
                <button
                  type="button"
                  className="istoki-admin-button"
                  onClick={() => setEditingId(item.id)}
                >
                  Изменить
                </button>
                <button
                  type="button"
                  className="istoki-admin-button is-danger"
                  onClick={() => {
                    if (window.confirm(`Удалить ${label}?`)) onDelete(item.id);
                  }}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RegionEditor;
