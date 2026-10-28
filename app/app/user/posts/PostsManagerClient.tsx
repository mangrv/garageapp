"use client";
import { useEffect, useMemo, useState } from "react";
import { reorderIds } from "@/lib/posts-helpers";
import Glyph from "@/app/components/Glyph";

type Media = { id: string; filename: string; mediaType: "image" | "video"; isPrimary: boolean; processingStatus?: "processing" | "ready" };
type Post = { id: string; title: string | null; caption: string | null; isPublished: boolean; job?: { title?: string | null } | null; media: Media[] };

export default function PostsManagerClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [reorderMode, setReorderMode] = useState<Record<string, boolean>>({});
  const load = async () => setPosts((await (await fetch("/api/posts")).json()).posts || []);
  useEffect(() => { load(); }, []);
  const standaloneCount = useMemo(() => posts.filter((p) => !p.job).length, [posts]);

  return <div className="max-w-4xl mx-auto p-4 space-y-4 text-white">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">Manage Posts</h1>
        <p className="text-sm text-gray-400">{posts.length} total · {standaloneCount} standalone</p>
      </div>
      <button className="px-3 py-2 rounded-xl bg-blue-600 font-semibold text-sm" onClick={async()=>{await fetch('/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'',caption:'',isPublished:false})}); load();}}>+ Create standalone post</button>
    </div>

    {posts.map((p) => <section key={p.id} className="border border-gray-700 rounded-2xl p-3 md:p-4 space-y-3 bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{p.title || p.job?.title || "Untitled post"}</h2>
          <p className="text-xs text-gray-400">{p.job ? "Linked to job" : "Standalone post"}</p>
        </div>
        <button onClick={async ()=>{await fetch(`/api/posts/${p.id}`,{method:'DELETE'});load();}} className="text-red-400 text-sm">Delete post</button>
      </div>

      <div className="flex flex-wrap gap-2 items-center text-sm">
        <button onClick={async ()=>{await fetch(`/api/posts/${p.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isPublished:!p.isPublished})});load();}} className={`px-3 py-1.5 rounded-xl font-medium ${p.isPublished ? 'bg-emerald-700' : 'bg-gray-700'}`}>{p.isPublished ? "Published" : "Unpublished"}</button>
        <button onClick={()=>setReorderMode((m)=>({ ...m, [p.id]: !m[p.id] }))} className="px-3 py-1.5 rounded-xl bg-gray-700">{reorderMode[p.id] ? "Done reordering" : "Reorder mode"}</button>
        <label className="px-3 py-1.5 rounded-xl bg-blue-700 cursor-pointer">Add media
          <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={async (e)=>{const fd=new FormData(); [...(e.target.files||[])].forEach(f=>fd.append('media',f)); const res = await fetch(`/api/posts/${p.id}/media`,{method:'POST',body:fd}); const json = await res.json().catch(() => ({})); if (res.ok && Array.isArray(json.media)) { setPosts((prev)=>prev.map((post)=>post.id===p.id ? ({ ...post, media: [...json.media, ...(post.media||[])] }) : post)); } else { load(); }}} />
        </label>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {p.media?.map((m, idx) => <div key={m.id} className="space-y-1">
          <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-black">
            {m.mediaType === "video" ? <>
              <img src={`/uploads/${m.filename}.thumb.webp`} alt="video thumb" className="w-full h-full object-cover" />
              <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 px-1.5 rounded">VIDEO</span>
              {m.processingStatus === "processing" && (
                <span className="absolute top-1 right-1 text-[10px] bg-blue-900/80 text-blue-200 px-1.5 rounded-full"><Glyph e="⏳" /> Processing</span>
              )}
            </> : <img src={`/uploads/${m.filename}`} alt="post" className="w-full h-full object-cover" />}
            {m.isPrimary && <span className="absolute top-1 left-1 text-[10px] bg-amber-500 text-on-accent px-1.5 rounded">PRIMARY</span>}
          </div>
          <div className="flex flex-wrap gap-1 text-xs">
            <button className="px-2 py-1 rounded bg-gray-700" onClick={async()=>{await fetch(`/api/posts/${p.id}/media/${m.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isPrimary:true})});load();}}>{m.isPrimary ? "Primary" : "Set primary"}</button>
            <button className="px-2 py-1 rounded bg-red-900" onClick={async()=>{await fetch(`/api/posts/${p.id}/media/${m.id}`,{method:'DELETE'});load();}}>Remove</button>
            {reorderMode[p.id] && <>
              <button className="px-2 py-1 rounded bg-gray-700" disabled={idx===0} onClick={async()=>{const order=reorderIds(p.media.map(x=>x.id),idx,idx-1); await fetch(`/api/posts/${p.id}/media`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({order})}); load();}}>↑</button>
              <button className="px-2 py-1 rounded bg-gray-700" disabled={idx===p.media.length-1} onClick={async()=>{const order=reorderIds(p.media.map(x=>x.id),idx,idx+1); await fetch(`/api/posts/${p.id}/media`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({order})}); load();}}>↓</button>
            </>}
          </div>
        </div>)}
      </div>
    </section>)}
  </div>;
}
