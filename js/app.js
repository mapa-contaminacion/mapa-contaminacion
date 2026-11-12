'use strict';
const map=L.map('map',{preferCanvas:true,zoomControl:false});L.control.zoom({position:'topright'}).addTo(map);const bounds=L.latLngBounds([[14.5,-117.9],[32.8,-86.5]]);map.fitBounds(bounds);
// Mapa base: Esri World Street Map (gratuito, sin clave). No se usa tile.openstreetmap.org
// porque OSM bloquea (403) las peticiones sin Referer, como ocurre al abrir index.html con doble clic.
// Si Esri falla varias veces, se cambia automáticamente a OSM France (HOT).
const BASES=[
 {url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',opt:{maxZoom:19,attribution:'Mapa base &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'}},
 {url:'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',opt:{maxZoom:19,subdomains:'abc',attribution:'&copy; OpenStreetMap contributors, teselas OSM France / HOT'}}
];
function baseLayer(extra){
 const make=i=>L.tileLayer(BASES[i].url,{...BASES[i].opt,attribution:BASES[i].opt.attribution+(extra||'')});
 let layer=make(0),errors=0;
 layer.on('tileerror',()=>{if(++errors===4&&layer._map){const m=layer._map;m.removeLayer(layer);make(1).addTo(m).bringToBack();}});
 return layer;
}
baseLayer().addTo(map);
const cluster=L.markerClusterGroup({disableClusteringAtZoom:12,showCoverageOnHover:false});map.addLayer(cluster);let DATA=[];
const $=id=>document.getElementById(id);const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function fill(id,key){let el=$(id);const options=[...new Set(DATA.map(r=>String(r[key]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));options.forEach(x=>el.add(new Option(x,x)));}
function compatible(r){return (!$("q").value||norm([r.establecimiento,r.municipio,r.estado,r.direccion,r.sector].join(' ')).includes(norm($("q").value)))&&(!$("state").value||r.estado===$("state").value)&&(!$("pollutant").value||r.contaminante===$("pollutant").value)&&(!$("sector").value||r.sector===$("sector").value)}
function render(){document.getElementById("poll-legend").style.opacity=$("pollutant").value?"1":"0.35";cluster.clearLayers();let rows=DATA.filter(compatible), list=$("records");list.replaceChildren();$("nVisible").textContent=rows.length.toLocaleString('es-MX');const values=rows.filter(r=>Number.isFinite(+r.emision)&&r.emision!=='').map(r=>+r.emision).sort((a,b)=>a-b);let low=values[Math.floor(values.length*.33)]??0, high=values[Math.floor(values.length*.66)]??0;
rows.forEach((r,i)=>{const val=Number(r.emision),valid=r.emision!==''&&Number.isFinite(val);const color=!$('pollutant').value?'#627e96':!valid?'#87969e':val<=low?'#45a06b':val<=high?'#ebc34b':'#c52b32';if(Number.isFinite(r.latitud)&&Number.isFinite(r.longitud)){let m=L.marker([r.latitud,r.longitud],{icon:L.divIcon({className:'',html:`<div class="pin" style="background:${color}"></div>`,iconSize:[20,20],iconAnchor:[10,10]})});let content=document.createElement('div');let h=document.createElement('b');h.textContent=r.establecimiento||'Fuente registrada';content.append(h);for(let line of [r.estado+' · '+r.municipio,'Contaminante: '+r.contaminante,'Emisión: '+(valid?r.emision+' '+r.unidad:'No reportada'),'Sector: '+r.sector,'Año: '+r.anio,'Fuente: '+r.fuente]){let d=document.createElement('div');d.textContent=line;content.append(d)}m.bindPopup(content);cluster.addLayer(m);if(i<65){let btn=document.createElement('button');btn.className='poll-item';btn.textContent=(r.establecimiento||'Fuente registrada')+' · '+r.contaminante;btn.onclick=()=>{map.setView([r.latitud,r.longitud],15);m.openPopup()};list.append(btn)}}});if(!list.children.length)list.textContent='No hay registros que coincidan.';refreshAgent();refreshSector();if(currentView===2){refreshAvailableMunicipal();updateMunicipal();}}
// Carga del CSV en el navegador con PapaParse (antes /api/registros).
// 1) Intenta leer data/contaminantes.csv (funciona en cualquier hosting web estático).
// 2) Si se abrió el index.html con doble clic (file://), usa la copia embebida data/contaminantes.js.
function parseCSV(source,download){return new Promise((resolve,reject)=>Papa.parse(source,{download,header:true,skipEmptyLines:true,complete:res=>res.data&&res.data.length?resolve(res.data):reject(Error('CSV vacío')),error:reject}));}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('No se encontró '+src));document.head.append(s);});}
async function readInventory(){
 if(location.protocol!=='file:'){try{return await parseCSV('data/contaminantes.csv',true);}catch(e){console.warn('CSV no disponible por HTTP, usando copia embebida',e);}}
 if(typeof window.RETC_CSV!=='string')await loadScript('data/contaminantes.js');
 return parseCSV(window.RETC_CSV.replace(/^\uFEFF/,''),false);
}
async function load(){try{$('agentHeadline').textContent='Cargando inventario RETC 2024…';DATA=Agente.setRows(await readInventory());$('nTotal').textContent=DATA.length.toLocaleString('es-MX');for(const [id,key] of [['state','estado'],['pollutant','contaminante'],['sector','sector']])fill(id,key);render();$('loadPill').classList.add('done');const h=Agente.health();$('health').textContent='Inventario cargado: '+h.registros.toLocaleString('es-MX')+' registros georreferenciados.'}catch(err){$('agentHeadline').textContent='No se pudo cargar el inventario: '+err.message;$('loadPill').classList.add('error');$('loadPill').lastChild.textContent='No se pudo cargar el inventario: '+err.message;$('health').textContent='No se pudo cargar el inventario.';}}
for(let id of ['q','state','pollutant','sector'])$(id).addEventListener(id==='q'?'input':'change',render);
$('reset').onclick=()=>{$('q').value='';for(let k of ['state','pollutant','sector'])$(k).value='';if(currentView===2)$('municipalPollutant').value=ALL_MUNICIPAL;render()};$('extent').onclick=()=>{(currentView===2?municipalMap:map).fitBounds(bounds)};

// Mapa municipal independiente: ArcGIS SEMARNAT (límites) + emisiones RETC 2024.
// La segunda vista requiere acceso a Internet para cargar el servicio de límites.
let currentView=1,municipalMap=null,municipalLayer=null,municipioTotals=new Map(),municipioUnit='',municipioCuts=[];
const ALL_MUNICIPAL='__TODAS_LAS_SUSTANCIAS__';
const municipalService='https://geomatica.semarnat.gob.mx/arcgis/rest/services/APLICACIONES/RETC_NACIONAL/MapServer/25';
const munPalette=['#FDEBEC','#F8C9CC','#F29AA0','#E85D68','#C92A36','#8E0E1A'];
const mapSourceState={ 'mexico':'estado de mexico','estado de mexico':'estado de mexico','coahuila de zaragoza':'coahuila','michoacan de ocampo':'michoacan','veracruz de ignacio de la llave':'veracruz','ciudad de mexico':'ciudad de mexico','distrito federal':'ciudad de mexico','nuevo leon':'nuevo leon','san luis potosi':'san luis potosi'};
function canonicalState(s){let t=norm(s).trim().replace(/\s+/g,' ');return mapSourceState[t]||t;}
function munKey(state,municipio){return canonicalState(state)+'|'+norm(municipio).trim();}
function showMunStatus(msg){const e=$('munStatus');e.textContent=msg;e.style.display=msg?'block':'none';}
function activateView(n){
 currentView=n;$('map').style.display=n===1?'block':'none';$('map2').style.display=n===2?'block':'none';
 $('viewPoints').classList.toggle('active',n===1);$('viewMunicipios').classList.toggle('active',n===2);
 $('munLegend').style.display=n===2?'block':'none';$('auto-agent').style.display=n===1?'block':'none';$('municipal-agent').style.display=n===2?'block':'none';$('municipalPollWrap').style.display=n===2?'block':'none';document.querySelectorAll('.only-point').forEach(e=>e.style.display=n===1?'':'none');$('municipioInfo').style.display=n===2?'block':'none';$('munStatus').style.display='none';
 if(n===2){refreshAvailableMunicipal();if(!municipalMap)initMunicipalMap();setTimeout(()=>municipalMap.invalidateSize(),100);updateMunicipal();}
 else setTimeout(()=>map.invalidateSize(),100);
}
$('viewPoints').onclick=()=>activateView(1);$('viewMunicipios').onclick=()=>activateView(2);
function initMunicipalMap(){
 municipalMap=L.map('map2',{preferCanvas:true,zoomControl:false}).fitBounds(bounds);L.control.zoom({position:'topright'}).addTo(municipalMap);
 baseLayer(' · Límites: SEMARNAT').addTo(municipalMap);
 if(!L.esri || !L.esri.featureLayer){showMunStatus('No pudo cargarse la biblioteca de límites municipales. Verifica tu conexión a Internet.');return;}
 municipalLayer=L.esri.featureLayer({url:municipalService,style:styleMunicipio,simplifyFactor:0.6,precision:5,where:'1=1'}).addTo(municipalMap);
 municipalLayer.on('click',ev=>{
  const p=ev.layer.feature?.properties||{};let state=p.NOM_ENT||'',municipio=p.NOM_MUN||'';
  const entry=municipioTotals.get(munKey(state,municipio));
  const value=entry?entry.total:0, count=entry?entry.sites.size:0;
  const all=$('municipalPollutant').value===ALL_MUNICIPAL;
  const substances=entry?.substances?[...entry.substances].sort((a,b)=>a.localeCompare(b,'es')):[];
  const detail=all?`Sustancias distintas reportadas: ${numFormat(value)}<br>Fuentes con registro: ${count}<br><b>Sustancias:</b> ${escapeHTML(substances.slice(0,18).join(', '))}${substances.length>18?'…':''}`:`Emisión reportada: ${numFormat(value)} ${escapeHTML(municipioUnit)}<br>Fuentes con registro: ${count}`;
  const str=`<b>${escapeHTML(municipio)}, ${escapeHTML(state)}</b><br>${entry?detail:'Sin emisiones registradas para la selección'}<br><small>RETC 2024 · emisiones al aire reportadas, no concentración ambiental</small>`;
  L.popup({autoPanPaddingTopLeft:[12,innerWidth<900?120:70],autoPanPaddingBottomRight:[12,innerWidth<900?230:20]}).setLatLng(ev.latlng).setContent(str).openOn(municipalMap);
  $('municipioInfo').innerHTML=str;
 });
 municipalLayer.on('requesterror',()=>showMunStatus('No se pudieron obtener los polígonos municipales de SEMARNAT. Comprueba Internet o el servicio geográfico.'));
 municipalLayer.on('load',()=>showMunStatus(''));
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function numFormat(v){return Number(v).toLocaleString('es-MX',{maximumFractionDigits:2});}
function styleMunicipio(feature){
 const p=feature.properties||{};const entry=municipioTotals.get(munKey(p.NOM_ENT,p.NOM_MUN));const amount=entry?.total||0;
 let i=-1;if(amount>0){i=munPalette.length-1;for(let n=0;n<municipioCuts.length;n++){if(amount<=municipioCuts[n]){i=n;break;}}}
 return {color:'#B8B8B8',weight:municipalMap?.getZoom()>9?0.7:0.28,opacity:.65,fillColor:i<0?'#E6E6E6':munPalette[i],fillOpacity:i<0?.32:.9};
}
function updateMunicipal(){
 if(!municipalMap)return;
 municipioTotals=new Map();const sub=$('municipalPollutant').value,all=sub===ALL_MUNICIPAL;
 const rows=DATA.filter(r=>municipalCompatible(r)&&(all||r.contaminante===sub));
 $('municipioInfo').textContent=all?'Haz clic en un municipio para ver las sustancias reportadas.':'Haz clic en un municipio para ver sus emisiones reportadas.';
 const legend=$('munLegend');legend.replaceChildren();
 const hd=document.createElement('b');hd.textContent=all?'Sustancias distintas reportadas por municipio · 2024':sub?`Emisión de ${sub} por municipio · 2024`:'Selecciona un contaminante';legend.append(hd);
 if(!sub){municipioCuts=[];if(municipalLayer)municipalLayer.setStyle(styleMunicipio);updateMunicipalAgent([],sub);return;}
 const valid=rows.filter(r=>Number.isFinite(Number(r.emision))&&Number(r.emision)>0&&r.contaminante&&r.unidad);
 const units=new Set(valid.map(r=>r.unidad));
 if(!all&&units.size!==1){showMunStatus('No hay unidades comparables para esta selección.');municipioCuts=[];if(municipalLayer)municipalLayer.setStyle(styleMunicipio);updateMunicipalAgent([],sub);return;}
 showMunStatus('');municipioUnit=all?'sustancias distintas':[...units][0];
 for(const r of valid){const key=munKey(r.estado,r.municipio);
  if(!municipioTotals.has(key))municipioTotals.set(key,{total:0,sites:new Set(),substances:new Set()});
  const x=municipioTotals.get(key);if(!all)x.total+=Number(r.emision);
  x.sites.add(r.nra||r.establecimiento);x.substances.add(r.contaminante);
 }
 if(all)for(const x of municipioTotals.values())x.total=x.substances.size;
 updateMunicipalAgent(valid,sub);
 const values=[...municipioTotals.values()].map(x=>x.total).filter(x=>x>0).sort((a,b)=>a-b);
 municipioCuts=munPalette.map((_,i)=>values.length?values[Math.min(values.length-1,Math.max(0,Math.ceil(values.length*(i+1)/munPalette.length)-1))]:0);
 const note=document.createElement('div');note.className='lg-note';note.textContent=all?'Número de sustancias diferentes con emisiones positivas al aire. No suma kilogramos de distintas sustancias. Gris: sin registro.':`Cantidad reportada (${municipioUnit}). Gris: sin registro.`;legend.append(note);
 munPalette.forEach((color,i)=>{const line=document.createElement('div'),square=document.createElement('i');line.className='lg-row';square.style.background=color;line.append(square,document.createTextNode(['Muy baja','Baja','Media-baja','Media','Alta','Muy alta'][i]+' · ≤ '+Number(municipioCuts[i]).toLocaleString('es-MX',{maximumFractionDigits:6})+(all?' sustancias':' '+municipioUnit)));legend.append(line)});
 const scale=document.createElement('div');scale.className='lg-scale';munPalette.forEach(c=>{const i=document.createElement('i');i.style.background=c;scale.append(i)});legend.append(scale);
 const caption=document.createElement('small');caption.className='lg-cap';caption.textContent=all?'Rojo claro: menor diversidad de sustancias reportadas; rojo oscuro: mayor diversidad. No mide carga total ni riesgo sanitario. Rangos por cuantiles.':'Rojo claro: menor emisión · Rojo oscuro: mayor emisión. Rangos por cuantiles (pueden repetirse si los datos son iguales). Son emisiones reportadas, no concentraciones en aire.';legend.append(caption);
 if(municipalLayer)municipalLayer.setStyle(styleMunicipio);
}
// Vista 2: lista independiente basada solo en emisiones positivas del filtro territorial.
function municipalCompatible(r){return (!$('q').value||norm([r.establecimiento,r.municipio,r.estado,r.direccion,r.sector].join(' ')).includes(norm($('q').value)))&&(!$('state').value||r.estado===$('state').value)&&(!$('sector').value||r.sector===$('sector').value)}
function refreshAvailableMunicipal(){
 const previous=$('municipalPollutant').value;
 const by=new Map();for(const r of DATA){if(!municipalCompatible(r))continue;let n=Number(r.emision);if(!(Number.isFinite(n)&&n>0&&r.contaminante&&r.unidad))continue;if(!by.has(r.contaminante))by.set(r.contaminante,{units:new Set(),count:0});let x=by.get(r.contaminante);x.units.add(r.unidad);x.count++}
 const available=[...by].filter(([name,x])=>x.units.size===1&&x.count>0).sort((a,b)=>a[0].localeCompare(b[0],'es'));
 const el=$('municipalPollutant');el.replaceChildren();if(available.length)el.add(new Option(`Todos los contaminantes (${available.length} sustancias)`,ALL_MUNICIPAL));for(const [name,x] of available)el.add(new Option(`${name} (${x.count} registros)`,name));
 if(previous===ALL_MUNICIPAL||available.some(([x])=>x===previous))el.value=previous;
 else if(available.length)el.value=ALL_MUNICIPAL;
 $('municipalCoverage').textContent=available.length+' sustancias con emisiones positivas y unidades compatibles según filtros de estado, sector y búsqueda.';
 if(!available.length){el.add(new Option('Sin contaminantes con emisiones',''));$('municipalHeadline').textContent='No hay emisiones positivas registradas para estos filtros. Prueba otro estado o tipo de fuente.';}
}
$('municipalPollutant').addEventListener('change',()=>{if(currentView===2)updateMunicipal()});
function updateMunicipalAgent(rows,sub){
 const all=sub===ALL_MUNICIPAL;
 const totals=[...municipioTotals.entries()].filter(([,x])=>x.total>0);
 const states=new Map(),cities=[];
 for(const [key,x] of totals){const [state,city]=key.split('|');cities.push({name:city,state,total:x.total,count:x.sites.size});}
 // Para «Todos», contar sustancias únicas por estado (sin sumar municipios).
 const grouped=new Map();
 for(const [key,x] of totals){const state=key.split('|')[0];if(!grouped.has(state))grouped.set(state,{total:0,municipios:0,substances:new Set()});let a=grouped.get(state);a.total+=x.total;a.municipios++;for(const v of x.substances)a.substances.add(v);}
 const topStates=[...grouped].map(([name,v])=>({name,...v,total:all?v.substances.size:v.total})).sort((a,b)=>b.total-a.total);
 cities.sort((a,b)=>b.total-a.total);
 const grand=all?new Set(rows.map(r=>r.contaminante)).size:totals.reduce((a,[,x])=>a+x.total,0);
 $('munSources').textContent=new Set(rows.map(r=>r.nra||r.establecimiento)).size.toLocaleString('es-MX');$('munCount').textContent=totals.length.toLocaleString('es-MX');
 $('municipalHeadline').textContent=!totals.length?'Sin emisiones positivas registradas para la selección.':all?`En el RETC 2024 hay ${grand} sustancias distintas reportadas con emisiones positivas para estos filtros. ${topStates[0].name} registra ${topStates[0].total} sustancias distintas y ${cities[0].name}, ${cities[0].state} registra ${cities[0].total}. Este ranking mide variedad de sustancias declaradas, NO la cantidad total emitida ni qué zona está más contaminada.`:`Para ${sub}, el mayor total estatal reportado corresponde a ${topStates[0].name} (${numFormat(topStates[0].total)} ${municipioUnit}). Municipio destacado: ${cities[0].name}, ${cities[0].state} (${numFormat(cities[0].total)} ${municipioUnit}). Se encontraron registros en ${totals.length} municipios. No representa niveles ambientales medidos.`;
 function rank(id,items,type){let root=$(id);root.replaceChildren();if(!items.length){root.textContent='Sin registros para esta selección';return;}
  items.slice(0,8).forEach((x,i)=>{let b=document.createElement('button');b.type='button';let title=document.createElement('b');title.textContent=(i+1)+'. '+(type==='state'?x.name:x.name+', '+x.state);let desc=document.createElement('small');desc.textContent=numFormat(x.total)+' '+municipioUnit+(all?'':' · '+(grand?((x.total/grand)*100).toFixed(1):0)+'%');b.append(title,desc);b.onclick=()=>{const seek=type==='state'?x.name:x.state;const candidates=rows.filter(r=>canonicalState(r.estado)===seek&&(type==='state'||norm(r.municipio)===x.name));const coordinates=candidates.filter(r=>Number.isFinite(+r.latitud)&&Number.isFinite(+r.longitud)).map(r=>[+r.latitud,+r.longitud]);if(coordinates.length){municipalMap.fitBounds(L.latLngBounds(coordinates).pad(.25),{maxZoom:type==='state'?8:11})}else showMunStatus('No hay coordenadas para acercar esta selección.');};root.append(b)});}
 rank('munStateRank',topStates,'state');rank('munCityRank',cities,'city');
}
let sectorVersion=0;
function refreshSector(){
 const version=++sectorVersion;
 try{
  const j=Agente.sectorDashboard($('state').value,$('sector').value,$('q').value);if(version!==sectorVersion)return;
  const root=$('sectorRank');root.replaceChildren();
  if(!j.ranking.length){root.textContent='No hay sustancias registradas para esta selección.';}
  j.ranking.slice(0,12).forEach((x,i)=>{
   const b=document.createElement('button');b.type='button';
   const title=document.createElement('b');title.textContent=(i+1)+'. '+x.nombre;
   const sub=document.createElement('small');sub.textContent=x.establecimientos.toLocaleString('es-MX')+' establecimientos · '+x.cobertura_pct+'% de fuentes';
   const amount=document.createElement('small');amount.textContent=x.total===null?'Cantidad no comparable':Number(x.total).toLocaleString('es-MX',{maximumFractionDigits:2})+' '+x.unidad+' reportados al aire';
   const bar=document.createElement('span');bar.className='agent-bar';const fill=document.createElement('i');fill.style.width=Math.max(1,x.cobertura_pct)+'%';bar.append(fill);
   if($('pollutant').value===x.nombre){b.style.outline='2px solid #138d7c'}
   b.append(title,sub,amount,bar);b.onclick=()=>{$('pollutant').value=x.nombre;render();zoomFiltered()};root.append(b);
  });
  const media=$('mediaReport');media.replaceChildren();
  j.medios.forEach(x=>{const d=document.createElement('div');d.className='media-pill';const title=document.createElement('b');title.textContent=x.nombre;const detail=document.createElement('small');detail.textContent=x.disponible?x.registros.toLocaleString('es-MX')+' registros':'Sin datos integrados';d.append(title,detail);media.append(d)});
 }catch(err){if(version===sectorVersion)$('sectorRank').textContent='Error consultando el ranking: '+err.message}
}
let summaryVersion=0;
function refreshAgent(){
 const version=++summaryVersion;
 try{const j=Agente.automaticSummary($('pollutant').value,$('state').value,$('sector').value,$('q').value);if(version!==summaryVersion)return;
 $('agentHeadline').textContent=j.mensaje;$('agentSources').textContent=Number(j.establecimientos||0).toLocaleString('es-MX');
 $('agentAmount').textContent=j.total===null?'Elegir sustancia':Number(j.total).toLocaleString('es-MX',{maximumFractionDigits:1})+' '+j.unidad;
 function rank(id,items,type){const el=$(id);el.replaceChildren();if(!items.length){el.textContent='Selecciona una sola sustancia para ver el ranking.';return}
 items.forEach((x,i)=>{let b=document.createElement('button');let title=document.createElement('b');title.textContent=(i+1)+'. '+(type==='state'?x.nombre:x.municipio+' · '+x.estado);let sub=document.createElement('small');sub.textContent=Number(x.valor).toLocaleString('es-MX',{maximumFractionDigits:2})+' '+j.unidad+' · '+x.porcentaje+'%';let bar=document.createElement('span');bar.className='agent-bar';let fill=document.createElement('i');fill.style.width=Math.max(1,x.porcentaje)+'%';bar.append(fill);b.append(title,sub,bar);b.onclick=()=>{if(type==='state'){$('state').value=x.nombre;render();zoomFiltered()}else{$('state').value=x.estado;$('q').value=x.municipio;render();zoomFiltered()}};el.append(b)})}
 rank('agentStates',j.ranking_estados,'state');rank('agentCities',j.ranking_municipios,'city');
 }catch(err){if(version===summaryVersion)$('agentHeadline').textContent='No se pudo calcular el análisis: '+err.message}
}
function zoomFiltered(){const pts=DATA.filter(compatible).filter(r=>Number.isFinite(r.latitud)&&Number.isFinite(r.longitud)).map(r=>[r.latitud,r.longitud]);if(pts.length)map.fitBounds(L.latLngBounds(pts).pad(.18),{maxZoom:12});}

load();
