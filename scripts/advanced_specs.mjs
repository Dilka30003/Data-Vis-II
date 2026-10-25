// Additional idioms built only from the existing, provenance-preserving CSVs.
// No invented person-level flows or distributions.
export function advancedSpecs({base,csv,tip,ages,green,rust}){
  const specs={};
  const add=(id,spec)=>{specs[id]={...base,...spec};};
  const pctTip=tip('percent','Adults (%)','quantitative','.1f');

  // Horizon chart: four 20-percentage-point bands are folded onto each row.
  // Separate palettes preserve the sign of change from the age's own 2017 value.
  const positive=['#dce8d4','#acc8a1','#6c9c78',green];
  const negative=['#f2deca','#dfb589','#cc8854',rust];
  const horizonY={type:'quantitative',scale:{domain:[7,0],nice:false},axis:{title:null,grid:false,values:ages.map((_,i)=>i+.48),labelExpr:`${JSON.stringify(ages)}[floor(datum.value)]`}};
  const horizonX={field:'year',type:'quantitative',scale:{domain:[2017,2025.9],nice:false},axis:{title:null,values:[2017,2019,2021,2023,2025],format:'d',grid:false,labelAngle:0}};
  const horizonTip=[tip('group','Age'),tip('year','Year','quantitative','d'),pctTip,tip('baseline','2017 baseline (%)','quantitative','.1f'),tip('change','Change from 2017 (pp)','quantitative','+.1f'),tip('base_n','Unweighted base','quantitative',','),tip('small_base','Base below 100 (1=yes)','quantitative')];
  const horizonLayers=[];
  for(const [sign,colours] of [[1,positive],[-1,negative]]){
    for(let band=0;band<4;band++){
      horizonLayers.push({
        transform:[{calculate:`datum.row + 0.85 - 0.68 * clamp(max(${sign} * datum.change, 0) - ${band*20}, 0, 20) / 20`,as:'folded_y'}],
        mark:{type:'area',color:colours[band],interpolate:'linear',clip:true},
        encoding:{x:horizonX,y:{field:'folded_y',...horizonY},y2:{field:'baseline_y'},detail:{field:'group'},tooltip:horizonTip}
      });
    }
  }
  horizonLayers.push({
    transform:[{filter:'datum.year === 2025'},{calculate:'datum.row + 0.48',as:'label_y'},{calculate:"format(datum.change, '+.1f') + ' pp'",as:'change_label'}],
    mark:{type:'text',align:'left',dx:5,fontSize:10},
    encoding:{x:{field:'year',type:'quantitative'},y:{field:'label_y',...horizonY},text:{field:'change_label'},color:{condition:{test:'datum.change >= 0',value:green},value:rust},tooltip:horizonTip}
  });
  add('age-horizon',{
    height:340,
    data:csv('phone_age_trends.csv'),
    transform:[
      {filter:'isValid(datum.percent)'},
      {calculate:'datum.year === 2017 ? datum.percent : null',as:'baseline_value'},
      {joinaggregate:[{op:'max',field:'baseline_value',as:'baseline'}],groupby:['group']},
      {calculate:'datum.percent - datum.baseline',as:'change'},
      {calculate:`indexof(${JSON.stringify(ages)},datum.group)`,as:'row'},
      {calculate:'datum.row + 0.85',as:'baseline_y'}
    ],
    layer:horizonLayers
  });

  const platforms=['Facebook','YouTube','Facebook Messenger','WhatsApp','Instagram','TikTok','Snapchat','Reddit'];
  const platformColours=['#225844','#b2592c','#66836f','#847544','#435b83','#9b5071','#a96b32','#616a51'];
  const rankTip=[tip('platform','Platform'),tip('year','Year','quantitative','d'),tip('rank','Rank among these eight','quantitative','d'),pctTip,tip('base_n','Unweighted base','quantitative',',')];
  add('platform-bump',{
    height:370,
    params:[{name:'platformFocus',value:'All eight'}],
    data:csv('platform_trends.csv'),
    transform:[
      {filter:`isValid(datum.percent) && indexof(${JSON.stringify(platforms)},datum.platform) >= 0`},
      {window:[{op:'rank',as:'rank'}],sort:[{field:'percent',order:'descending'}],groupby:['year']},
      {calculate:"datum.platform === 'Facebook Messenger' ? 'Messenger' : datum.platform",as:'endpoint_label'}
    ],
    encoding:{
      x:{field:'year',type:'quantitative',scale:{domain:[2021,2025.9],nice:false},axis:{title:null,format:'d',values:[2021,2022,2023,2024,2025],grid:false,labelAngle:0}},
      y:{field:'rank',type:'quantitative',scale:{domain:[8.5,.5],nice:false},axis:{title:'Rank among eight',values:[1,2,3,4,5,6,7,8],grid:true}},
      color:{field:'platform',type:'nominal',scale:{domain:platforms,range:platformColours},legend:null},
      opacity:{condition:{test:"platformFocus === 'All eight' || datum.platform === platformFocus",value:1},value:.12},
      tooltip:rankTip
    },
    layer:[
      {mark:{type:'line',strokeWidth:2.5},encoding:{detail:{field:'platform'},order:{field:'year',type:'quantitative'}}},
      {mark:{type:'point',filled:true,size:58,stroke:'#fffefa',strokeWidth:1}},
      {transform:[{filter:"datum.year === 2025 && platformFocus !== 'All eight' && datum.platform === platformFocus"}],mark:{type:'point',filled:false,size:180,strokeWidth:2}},
      {transform:[{filter:'datum.year === 2025'}],mark:{type:'text',align:'left',dx:9,fontSize:12,fontWeight:600},encoding:{text:{field:'endpoint_label'}}}
    ]
  });

  const rolloutTip=[tip('operator','Operator'),tip('year','Reference year','quantitative','d'),tip('series','Series'),tip('sites','Site records','quantitative',',')];
  // Preserve the chart ID and linked operator control; time is now the x-axis.
  add('network-trajectory',{
    height:370,
    params:[{name:'operatorChoice',value:'Telstra'}],
    data:csv('network_national.csv'),
    transform:[
      {filter:'datum.operator === operatorChoice && datum.year >= 2020 && datum.year <= 2026'},
      {fold:['total_sites','five_g_sites'],as:['metric','sites']},
      {filter:'isValid(datum.sites)'},
      {calculate:"datum.metric === 'total_sites' ? 'All sites' : '5G-enabled sites'",as:'series'}
    ],
    encoding:{
      x:{field:'year',type:'quantitative',scale:{domain:[2020,2026],nice:false},axis:{title:null,format:'d',values:[2020,2021,2022,2023,2024,2025,2026],labelAngle:0,grid:false}},
      y:{field:'sites',type:'quantitative',scale:{domain:[0,14000],nice:false},axis:{title:'Site records',format:'~s',tickCount:5}},
      color:{field:'series',type:'nominal',scale:{domain:['All sites','5G-enabled sites'],range:[green,rust]},legend:null},
      tooltip:rolloutTip
    },
    layer:[
      {mark:{type:'line',strokeWidth:2.5},encoding:{detail:{field:'series'},order:{field:'year',type:'quantitative'}}},
      {mark:{type:'point',filled:true,size:56,stroke:'#fffefa',strokeWidth:1}},
      {transform:[{filter:'datum.year === 2026'}],mark:{type:'text',align:'right',dx:-6,dy:-12,fontSize:11,fontWeight:600},encoding:{text:{field:'series'}}}
    ]
  });

  const dimensions=['Access','Affordability','Digital ability','Index'];
  const profileTip=[tip('state_name','State / territory'),tip('measure','Dimension'),tip('score','Score / 100','quantitative','.1f')];
  const profileEncoding={
    x:{field:'measure',type:'ordinal',sort:dimensions,axis:{title:null,grid:true,labelAngle:0,labelPadding:13,labelLimit:120}},
    y:{field:'score',type:'quantitative',scale:{domain:[60,85],nice:false},axis:{title:'ADII score (cropped 60–85)',values:[60,65,70,75,80,85]}},
    detail:{field:'state'},order:{field:'dimension_order',type:'quantitative'},tooltip:profileTip
  };
  add('inclusion-parallel',{
    height:340,
    params:[{name:'profileState',value:'VIC'}],
    data:csv('adii_state_scores.csv'),
    transform:[{calculate:`indexof(${JSON.stringify(dimensions)},datum.measure)`,as:'dimension_order'}],
    encoding:profileEncoding,
    layer:[
      {transform:[{filter:'datum.state !== profileState'}],mark:{type:'line',color:'#bac5b1',opacity:.72,strokeWidth:1.6,point:{filled:true,size:26,color:'#bac5b1'}}},
      {transform:[{filter:'datum.state === profileState'}],mark:{type:'line',color:green,strokeWidth:3,point:{filled:true,size:68,color:green}}},
      {transform:[{filter:"datum.state === profileState && datum.measure === 'Index'"}],mark:{type:'text',dy:-15,fontWeight:600,color:green,fontSize:11},encoding:{text:{field:'state'}}}
    ]
  });
  return specs;
}
