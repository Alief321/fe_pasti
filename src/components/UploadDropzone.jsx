import { useRef, useState } from 'react';
import { FiCheckCircle, FiFile, FiUploadCloud } from 'react-icons/fi';

export default function UploadDropzone({ accept, multiple = false, files, onFiles, title = 'Pilih file', description = 'Tarik dan lepas file di sini atau klik untuk memilih', className = '' }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const selectedFiles = !files ? [] : Array.isArray(files) ? files : typeof FileList !== 'undefined' && files instanceof FileList ? [...files] : [files];

  function handleFiles(nextFiles) {
    if (!nextFiles?.length) return;
    onFiles(nextFiles);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false);
      }}
      onDrop={handleDrop}
      className={`group cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'} ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
        className="hidden"
      />
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105">
        {selectedFiles.length ? <FiCheckCircle size={25} /> : <FiUploadCloud size={26} />}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{selectedFiles.length ? `${selectedFiles.length} file dipilih` : title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {!!selectedFiles.length && (
        <div className="mt-3 space-y-1 text-left">
          {selectedFiles.map((file) => (
            <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
              <FiFile className="shrink-0 text-blue-500" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-slate-400">{Math.max(1, Math.round(file.size / 1024))} KB</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
