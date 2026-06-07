import { memo } from 'react'

export default function StudyNotePanel({
  note,
  onChangeNote,
  onSave,
  dirty,
  canUpdate,
}) {
  return (
    <div className="mx-auto w-full max-w-2xl text-left">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-gray-950">我的笔记</h3>
        <button
          type="button"
          onClick={onSave}
          className="h-8 rounded-lg bg-gray-900 px-3 text-[11px] font-black text-white disabled:bg-gray-300"
          disabled={!dirty || !canUpdate}
        >
          保存
        </button>
      </div>
      <textarea
        value={note}
        onChange={(event) => onChangeNote(event.target.value)}
        placeholder="写下这张卡的理解、易错点或补充材料"
        className="min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
      />
    </div>
  )
}