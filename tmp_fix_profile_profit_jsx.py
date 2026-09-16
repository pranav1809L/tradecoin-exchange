from pathlib import Path
p=Path('/home/ubuntu/tradecoin-marketplace/client/src/pages/Profile.tsx')
s=p.read_text()
s=s.replace(': <div className="mt-4 grid gap-3 sm:grid-cols-2">', ': <><div className="mt-4 grid gap-3 sm:grid-cols-2">', 1)
s=s.replace('</div>}</section></div></main></div>;', '</div></>}</section></div></main></div>;', 1)
p.write_text(s)
