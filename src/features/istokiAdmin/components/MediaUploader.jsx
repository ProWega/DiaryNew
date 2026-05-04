import { useState } from "react";
import { uploadFile } from "../api";

function MediaUploader({ kind, value, onChange, accept, helpText }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const result = await uploadFile(kind, file);
      onChange(result.url);
    } catch (err) {
      setError(err?.message || "Ошибка загрузки");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="istoki-admin-uploader">
      <input
        className="istoki-admin-input"
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="URL или загрузите файл"
      />
      <label className="istoki-admin-button">
        {uploading ? "Загрузка…" : "Загрузить"}
        <input type="file" accept={accept} hidden onChange={handleFile} disabled={uploading} />
      </label>
      {helpText && <div className="istoki-admin-field-hint">{helpText}</div>}
      {error && <div className="istoki-admin-field-error">{error}</div>}
      {value && kind === "photo" && (
        <img className="istoki-admin-uploader-preview" src={value} alt="Превью" />
      )}
      {value && kind === "audio" && (
        <audio controls preload="none" src={value} className="istoki-admin-uploader-audio">
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}

export default MediaUploader;
