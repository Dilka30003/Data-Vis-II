// Additional spatial encodings, with no synthetic people or coverage surfaces.
export function mapSpecs({base,csv,tip,green}){
  const geo={url:'data/australian_states.geojson',format:{type:'json',property:'features'}};
  const cells={url:'data/victoria_hexbins_2026.geojson',format:{type:'json',property:'features'}};
  const hexBase={
    data:cells,
    transform:[
      {calculate:"hexTechnology === '5g' ? datum.properties.five_g_records : hexTechnology === 'other' ? datum.properties.other_records : datum.properties.record_count",as:'shown_count'},
      {filter:'datum.shown_count > 0'},
      {calculate:"datum.shown_count < 5 ? '1–4' : datum.shown_count < 20 ? '5–19' : datum.shown_count < 100 ? '20–99' : '100+'",as:'count_band'}
    ],
    mark:{type:'geoshape',stroke:'#fffefa',strokeWidth:.55},
    encoding:{
      color:{field:'count_band',type:'ordinal',
        scale:{domain:['1–4','5–19','20–99','100+'],range:['#e0e8d4','#b1cba4','#6e9e78',green]},
        legend:{title:'Records per ~260 km² cell',orient:'bottom',direction:'horizontal',columns:4,labelFontSize:10,symbolType:'square'}},
      tooltip:[tip('properties.cell_id','Grid cell'),
        tip('shown_count','Selected source records','quantitative',','),
        tip('properties.record_count','All records in cell','quantitative',','),
        tip('properties.five_g_records','5G-band records','quantitative',','),
        tip('properties.other_records','No 5G band recorded','quantitative',','),
        tip('properties.cell_area_km2','Full cell area (km²)','quantitative','.1f')]
    }
  };
  const victoriaFilter={filter:"datum.properties.state === 'VIC'"};
  const hex={
    ...base,height:410,
    params:[{name:'hexTechnology',value:'all'}],
    projection:{type:'mercator'},
    layer:[
      {data:geo,transform:[victoriaFilter],mark:{type:'geoshape',fill:'#f0f1e7',stroke:null}},
      // Invisible full grid fixes the fitted extent while technology is filtered.
      {data:cells,mark:{type:'geoshape',fillOpacity:0,strokeOpacity:0}},
      hexBase,
      {data:geo,transform:[victoriaFilter],mark:{type:'geoshape',fill:null,stroke:'#9eac98',strokeWidth:.8}}
    ]
  };
  const scoreColour={
    field:'score',type:'quantitative',
    scale:{domain:[60,85],range:['#f0f0df',green]},
    legend:{title:'ADII score (cropped 60–85)',orient:'bottom',direction:'horizontal',gradientLength:210,values:[60,65,70,75,80,85]}
  };
  const labelColour={condition:{test:'datum.score >= 78',value:'#fffefa'},value:'#193d2a'};
  const mapTip=[tip('state_name','State / territory'),tip('measure','Dimension'),
    tip('score','ADII score / 100','quantitative','.1f'),
    tip('data_year','Data year','quantitative','d')];
  // Authored label anchors only; they are not survey observations.
  const anchors=[
    {state:'WA',lon:121.5,lat:-25.5},{state:'NT',lon:133.3,lat:-19.5},
    {state:'SA',lon:135.3,lat:-30},{state:'QLD',lon:144.5,lat:-23},
    {state:'NSW',lon:147,lat:-32.3},{state:'VIC',lon:144.1,lat:-36.7},
    {state:'TAS',lon:146.6,lat:-42.2},{state:'ACT',lon:148.99,lat:-35.48}
  ];
  const location={longitude:{field:'lon',type:'quantitative'},
    latitude:{field:'lat',type:'quantitative'}};
  const shapes={mark:{type:'geoshape',stroke:'#fffefa',strokeWidth:1.2},
    encoding:{shape:{field:'map_feature',type:'geojson'},color:scoreColour,tooltip:mapTip}};
  const national={
    width:610,height:440,
    projection:{type:'conicEqualArea',parallels:[-18,-36],rotate:[-134,0,0]},
    layer:[shapes,
      {transform:[{filter:"indexof(['ACT','VIC','TAS'], datum.state) < 0"}],
        mark:{type:'text',fontSize:12,fontWeight:600,dy:-7},
        encoding:{...location,text:{field:'state'},color:labelColour,tooltip:mapTip}},
      {transform:[{filter:"indexof(['ACT','VIC','TAS'], datum.state) < 0"}],
        mark:{type:'text',fontSize:12,dy:9},
        encoding:{...location,text:{field:'score',type:'quantitative',format:'.1f'},
          color:labelColour,tooltip:mapTip}},
      {transform:[{filter:"datum.state === 'VIC' || datum.state === 'TAS'"},
          {calculate:"datum.state + ' ' + format(datum.score, '.1f')",as:'compact_label'}],
        mark:{type:'text',fontSize:12,fontWeight:600,color:'#193d2a'},
        encoding:{...location,text:{field:'compact_label'},tooltip:mapTip}},
      {transform:[{filter:"datum.state === 'ACT'"}],
        mark:{type:'point',filled:false,size:50,stroke:'#193d2a',strokeWidth:1.2},
        encoding:{...location,tooltip:mapTip}}
    ]
  };
  const inset={
    width:150,height:155,
    transform:[{filter:"datum.state === 'ACT'"}],
    projection:{type:'mercator'},
    layer:[shapes,
      {mark:{type:'text',fontSize:13,fontWeight:600,dy:-8},
        encoding:{...location,text:{field:'state'},color:labelColour,tooltip:mapTip}},
      {mark:{type:'text',fontSize:12,dy:10},
        encoding:{...location,text:{field:'score',type:'quantitative',format:'.1f'},
          color:labelColour,tooltip:mapTip}}
    ]
  };
  const {width,height,autosize,...compositeBase}=base;
  const inclusionMap={
    ...compositeBase,
    autosize:{type:'pad',contains:'padding'},spacing:24,
    params:[{name:'tileDimension',value:'Index'}],
    data:csv('adii_state_scores.csv'),
    transform:[{filter:'datum.measure === tileDimension'},
      {lookup:'state',from:{data:geo,key:'properties.state',fields:['geometry']}},
      {lookup:'state',from:{data:{values:anchors},key:'state',fields:['lon','lat']}},
      {calculate:"{type: 'Feature', geometry: datum.geometry}",as:'map_feature'}],
    hconcat:[national,inset],
    resolve:{scale:{color:'shared'}}
  };
  return {'victoria-hexbins':hex,'inclusion-tiles':inclusionMap};
}
