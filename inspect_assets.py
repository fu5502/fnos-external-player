with open("/usr/local/apps/@appcenter/trim.media/static/assets/74c95604043427f0bee1d0e16bfa53af-DsH45n0p.js", errors="ignore") as f:
    txt = f.read()

pos = txt.find("var HB=e=>{")
print(txt[pos:pos+800])