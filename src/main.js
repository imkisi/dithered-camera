import './style.css'

const canvas = document.getElementById('camera-canvas');
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

if (!gl) {
  alert('WebGL not supported');
}

// --- Shaders ---

const vsSource = `
  attribute vec4 aVertexPosition;
  attribute vec2 aTextureCoord;
  varying highp vec2 vTextureCoord;
  void main(void) {
    gl_Position = aVertexPosition;
    vTextureCoord = aTextureCoord;
  }
`;

const fsSource = `
  precision highp float;
  varying highp vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform float uContrast;
  uniform float uResolution;
  uniform int uPaletteType;
  uniform vec2 uTexSize;

  // 8x8 Bayer Matrix
  float bayer8(vec2 uv) {
    vec2 p = floor(mod(uv * uTexSize / uResolution, 8.0));
    int x = int(p.x);
    int y = int(p.y);
    
    float m[64];
    m[0]=0.0;  m[1]=32.0; m[2]=8.0;  m[3]=40.0; m[4]=2.0;  m[5]=34.0; m[6]=10.0; m[7]=42.0;
    m[8]=48.0; m[9]=16.0; m[10]=56.0; m[11]=24.0; m[12]=50.0; m[13]=18.0; m[14]=58.0; m[15]=26.0;
    m[16]=12.0; m[17]=44.0; m[18]=4.0;  m[19]=36.0; m[20]=14.0; m[21]=46.0; m[22]=6.0;  m[23]=38.0;
    m[24]=60.0; m[25]=28.0; m[26]=52.0; m[27]=20.0; m[28]=62.0; m[29]=30.0; m[30]=54.0; m[31]=22.0;
    m[32]=3.0;  m[33]=35.0; m[34]=11.0; m[35]=43.0; m[36]=1.0;  m[37]=33.0; m[38]=9.0;  m[39]=41.0;
    m[40]=51.0; m[41]=19.0; m[42]=59.0; m[43]=27.0; m[44]=49.0; m[45]=17.0; m[46]=57.0; m[47]=25.0;
    m[48]=15.0; m[49]=47.0; m[50]=7.0;  m[51]=39.0; m[52]=13.0; m[53]=45.0; m[54]=5.0;  m[55]=37.0;
    m[56]=63.0; m[57]=31.0; m[58]=55.0; m[59]=23.0; m[60]=61.0; m[61]=29.0; m[62]=53.0; m[63]=21.0;

    int index = y * 8 + x;
    for(int i = 0; i < 64; i++) {
        if (i == index) return m[i] / 64.0;
    }
    return 0.0;
  }

  vec3 applyPalette(float luma) {
    if (uPaletteType == 1) { // Gameboy
      if (luma < 0.25) return vec3(0.058, 0.219, 0.058);
      if (luma < 0.5)  return vec3(0.188, 0.384, 0.188);
      if (luma < 0.75) return vec3(0.545, 0.674, 0.058);
      return vec3(0.607, 0.737, 0.058);
    } else if (uPaletteType == 2) { // Retro
      if (luma < 0.2) return vec3(0.0, 0.0, 0.0);
      if (luma < 0.4) return vec3(0.6, 0.0, 0.6);
      if (luma < 0.6) return vec3(0.0, 0.6, 0.6);
      if (luma < 0.8) return vec3(0.6, 0.6, 0.0);
      return vec3(1.0, 1.0, 1.0);
    }
    return vec3(luma); // B&W
  }

  void main(void) {
    vec2 uv = vTextureCoord;
    // Pixelation
    if (uResolution > 1.0) {
        uv = floor(uv * uTexSize / uResolution) / (uTexSize / uResolution);
    }
    
    vec4 texel = texture2D(uSampler, uv);
    
    // Contrast
    vec3 color = (texel.rgb - 0.5) * uContrast + 0.5;
    
    // Grayscale
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    
    // Dithering
    float limit = bayer8(vTextureCoord);
    float finalLuma = luma > limit ? 1.0 : 0.0;
    
    gl_FragColor = vec4(applyPalette(luma > limit ? (luma * 1.2) : (luma * 0.8)), 1.0);
  }
`;

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

const shaderProgram = gl.createProgram();
gl.attachShader(shaderProgram, vertexShader);
gl.attachShader(shaderProgram, fragmentShader);
gl.linkProgram(shaderProgram);

if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
  alert('Unable to initialize the shader program');
}

const programInfo = {
  program: shaderProgram,
  attribLocations: {
    vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
  },
  uniformLocations: {
    projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
    modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
    uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
    uContrast: gl.getUniformLocation(shaderProgram, 'uContrast'),
    uResolution: gl.getUniformLocation(shaderProgram, 'uResolution'),
    uPaletteType: gl.getUniformLocation(shaderProgram, 'uPaletteType'),
    uTexSize: gl.getUniformLocation(shaderProgram, 'uTexSize'),
  },
};

// --- Buffers ---

const positions = new Float32Array([
  -1.0,  1.0,
   1.0,  1.0,
  -1.0, -1.0,
   1.0, -1.0,
]);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

const textureCoords = new Float32Array([
  0.0, 0.0,
  1.0, 0.0,
  0.0, 1.0,
  1.0, 1.0,
]);

const textureCoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);

// --- Texture & Camera ---

const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

const video = document.createElement('video');
video.autoplay = true;
video.muted = true;
video.playsInline = true;

let state = {
  resolution: 4,
  contrast: 1.1,
  palette: 0, // 0: BW, 1: GB, 2: Retro
  width: 0,
  height: 0
};

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 }
        } 
    });
    video.srcObject = stream;
    await video.play();
    
    state.width = video.videoWidth;
    state.height = video.videoHeight;
    canvas.width = state.width;
    canvas.height = state.height;
    
    requestAnimationFrame(render);
  } catch (err) {
    console.error("Camera access denied:", err);
    alert("Please allow camera access to use this effect.");
  }
}

function render() {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(programInfo.program);

  // Position Attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  // Texture Coord Attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

  // Texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

  // Uniforms
  gl.uniform1f(programInfo.uniformLocations.uContrast, state.contrast);
  gl.uniform1f(programInfo.uniformLocations.uResolution, state.resolution);
  gl.uniform1i(programInfo.uniformLocations.uPaletteType, state.palette);
  gl.uniform2f(programInfo.uniformLocations.uTexSize, state.width, state.height);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(render);
}

// --- Event Listeners ---

document.getElementById('resolution').addEventListener('input', (e) => {
  state.resolution = parseFloat(e.target.value);
});

document.getElementById('contrast').addEventListener('input', (e) => {
  state.contrast = parseFloat(e.target.value);
});

document.querySelectorAll('.palette-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const p = btn.dataset.palette;
    if (p === 'bw') state.palette = 0;
    else if (p === 'gb') state.palette = 1;
    else if (p === 'retro') state.palette = 2;
  });
});

document.getElementById('capture-btn').addEventListener('click', () => {
  // Render one frame specifically for capture to ensure buffer is current
  render();
  
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.download = `dither-cam-${timestamp}.png`;
  link.href = dataUrl;
  link.click();
});

setupCamera();
