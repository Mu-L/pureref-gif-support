const {
  ipcRenderer, 
  contextBridge 
} = require('electron')

const interact = require('./interact.min.js')
let state = {
  init: false,
  currentScale: 1,
  translate: {
    translateX: 0,
    translateY: 0
  },
  elements: [

  ]
}
document.addEventListener('keydown', evt => {
  if (evt.key === 'c' && evt.ctrlKey) {
      //alert('Ctrl+C was pressed');
  } else if (evt.key === 'v' && evt.ctrlKey) {
    ipcRenderer.send('handle-paste')
    console.log('Ctrl+V was pressed');
  }
});

document.addEventListener('contextmenu', () => {
  if(mouseObj.dragToggle) {
    mouseObj.dragToggle = false; 
    return;
  }
  
    ipcRenderer.send('show-context-menu')
})
let mouseObj = {
  initPos: null,
  initClientPos: null,
  dragToggle: false,
  //time dragging & distance dragged
}
document.addEventListener('mousedown', (e) => {
  mouseObj.initPos = {x: e.clientX, y: e.clientY}
  mouseObj.initClientPos = {x: e.screenX, y: e.screenY}
  ipcRenderer.send('record-window-size', window.innerHeight, window.innerHeight)
  mouseObj.dragToggle = false
})
document.addEventListener('mousemove', (e) => {
  if(e.buttons == 2){
      ipcRenderer.send('move-electron-window', e.screenX, e.screenY, mouseObj.initPos)
      mouseObj.dragToggle = true;
      
  }
})
document.addEventListener('mouseup', (e) => {
  if(mouseObj.dragToggle){
    distance = Math.sqrt(
                Math.pow(e.screenX - mouseObj.initClientPos.x, 2) 
                +
                Math.pow(e.screenY - mouseObj.initClientPos.y, 2) );

    if(distance < 10){ 
      mouseObj.dragToggle = false;
    }

  }
})

ipcRenderer.on('clipboard', (event, msg) => {
  let payload = JSON.parse(msg);
  console.log(payload)
  if(payload.type == 'filePath'){
    addImageWithPath(payload.filePath)
  }
  if(payload.type == 'dataURL'){
    addImageWithPath(payload[payload.type])
    //URL.createObjectURL(object)
  }
})
function addVideoWithPath(path){
  var elementObj = {
    path: path,
    type: undefined,
    element: undefined
  }
  let vidElement = document.createElement('video')
  vidElement.autoplay = true;
  vidElement.muted = true;
  vidElement.classList.add('draggable')
  let srcElement = document.createElement('source')
  srcElement.src = path;
  vidElement.appendChild(srcElement)
  
  elementObj.type = 'video'
  elementObj.element = vidElement

  state.elements.push(elementObj)
  

  itemHolder.appendChild(elementObj.element)
}
function addImageWithPath(path){
  document.querySelector('#welcome') && document.querySelector('#welcome').remove()
  let itemHolder = document.getElementById('itemHolder')
  let newImg = document.createElement('img')
  newImg.src = path;
  newImg.classList.add('draggable')
  zIndex = state.elements.length;
  newImg.style.zIndex = zIndex
  newImg.dataset.index = zIndex
  state.elements.push({
    path: path,
    type: 'img',
    element: newImg
  })

  itemHolder.appendChild(newImg)
}

document.addEventListener('drop', (event) => {
  event.preventDefault();
  event.stopPropagation();
  if(!state.init) init();
  // Todo check if file is valid
  
  
  for (const f of event.dataTransfer.files) {
      // Using the path attribute to get absolute file path
      console.log('File Path of dragged files: ', f.path)
      if(f.path.endsWith('.mp4')){
        addVideoWithPath(f.path)
      } else
        addImageWithPath(f.path)
    }
});
function init(){
  document.documentElement.addEventListener('click', (event) => {
    var target = event.target
    if(target.id == 'root'){
      console.log('background click')
      clearAllSelected()
    }
  })
}

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

contextBridge.exposeInMainWorld('myAPI', {
  updateScale: (newScale) => {
    state.currentScale = newScale
  },
  updateTranslate: (newTranslate) =>{
    state.translate = newTranslate
  },
  toggleResize: (enabled) =>{
    toggleResize(enabled)
  }
})
function toggleResize(enabled) {
  if(!enabled){
    interact('.draggable').resizable(false)
  }
  else
  interact('.draggable').resizable({
    // resize from all edges and corners
    //allowFrom: '.selectedItem',
    edges: { left: enabled, right: enabled, bottom: enabled, top: enabled },
    ratio: 1,
    enabled: enabled,
    listeners: [{
      move (event) {
        var target = event.target
        var x = (parseFloat(target.getAttribute('data-x')) || 0)
        var y = (parseFloat(target.getAttribute('data-y')) || 0)

        // update the element's style
        target.style.width = event.rect.width / state.currentScale + 'px'
        target.style.height = event.rect.height / state.currentScale + 'px'

        // translate when resizing from top or left edges
        x += event.deltaRect.left / state.currentScale
        y += event.deltaRect.top / state.currentScale

        target.style.transform = 'translate(' + x + 'px,' + y + 'px)'

        target.setAttribute('data-x', x)
        target.setAttribute('data-y', y)
        target.textContent = Math.round(event.rect.width) + '\u00D7' + Math.round(event.rect.height)
        forceRedraw()
      }
    }],
    modifiers: [
      interact.modifiers.aspectRatio({
        // make sure the width is always double the height
        ratio: 'preserve',
        // also restrict the size by nesting another modifier
      }),

      // minimum size
      interact.modifiers.restrictSize({
        min: { width: 10 }
      })
    ],

    inertia: true
  })
}

interact('.draggable')
  .draggable({
    listeners: { move: dragMoveListener },
    inertia: false
  }).on('tap', function (event) {
    var target = event.target
    handleSelected(target)
    //
    event.preventDefault()
  })
toggleResize(false)
function clearAllSelected(){
  document.querySelectorAll('.selectedItem').forEach((elm)=>{
    elm.classList.remove('selectedItem')
  })
  toggleResize(false)
}
function handleSelected(target, dragging = false){
  var isSelected = target.classList.contains('selectedItem')
  if(!dragging){
    clearAllSelected()
  }
  if(!isSelected){
    if(dragging){
      clearAllSelected()
      
    }
    target.classList.add('selectedItem')
    toggleResize(true)
    //myAPI.toggleResize(true)
  }
  else{
    toggleResize(dragging)
  }
  if(state.elements.length > 1){
    let targetIndex = target.dataset.index;
    state.elements.push(state.elements.splice(targetIndex, 1)[0]);
    for(var i = targetIndex; i < state.elements.length; i++){ // i can start at targetIndex
      state.elements[i].element.style.zIndex = i;
      state.elements[i].element.dataset.index = i;
    }
  }
}

function dragMoveListener (event) {
  var target = event.target
  handleSelected(target, true)
  // keep the dragged position in the data-x/data-y attributes
  var x = (parseFloat(target.getAttribute('data-x')) || 0) + (event.dx / state.currentScale) //+ (state.translate.translateX / state.currentScale)
  var y = (parseFloat(target.getAttribute('data-y')) || 0) + (event.dy / state.currentScale) //+ (state.translate.translateY / state.currentScale)
  //x = x / state.currentScale
  //y = y / state.currentScale

  // translate the element
  target.style.transform = 'translate(' + x + 'px, ' + y + 'px)'

  // update the posiion attributes
  target.setAttribute('data-x', x)
  target.setAttribute('data-y', y)
  forceRedraw()
}

function forceRedraw(){
  if(document.body.parentElement.style.backgroundColor == ''){
    document.body.parentElement.style.backgroundColor = '#04040400'
  } else{
    document.body.parentElement.style.backgroundColor = ''
  }
}
