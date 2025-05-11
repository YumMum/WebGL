console.log('Happy developing ✨')
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const glCanvas = document.getElementById('glCanvas');
const loadingIndicator = document.getElementById('loadingIndicator');
const noImageMessage = document.getElementById('noImageMessage');
const imageInfo = document.getElementById('imageInfo');
const fileName = document.getElementById('fileName');
const imageSize = document.getElementById('imageSize');
const imageFormat = document.getElementById('imageFormat');
const rotationSlider = document.getElementById('rotation');
const rotationValue = document.getElementById('rotationValue');
const scaleSlider = document.getElementById('scale');
const scaleValue = document.getElementById('scaleValue');
const brightnessSlider = document.getElementById('brightness');
const brightnessValue = document.getElementById('brightnessValue');
const contrastSlider = document.getElementById('contrast');
const contrastValue = document.getElementById('contrastValue');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
const navbar = document.getElementById('navbar');

// WebGL上下文和变量
let gl;
let program;
let texture;
let image = null;
let currentTransform = {
    rotation: 0,
    scale: 1,
    brightness: 1,
    contrast: 1
};

// 初始化WebGL
function initWebGL() {
    try {
        // 获取WebGL上下文
        gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
        if (!gl) {
            alert('无法初始化WebGL，您的浏览器可能不支持。');
            return;
        }
        // 初始化着色器
        initShaders();
        // 设置视口
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        // 设置清除颜色
        gl.clearColor(0.96, 0.96, 0.96, 1.0);
        // 启用透明度混合
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } catch (e) {
        console.error('初始化WebGL失败:', e);
        alert('初始化WebGL失败，请检查控制台错误信息。');
    }
}

// 初始化着色器
function initShaders() {
    // 顶点着色器
    const vertexShaderSource = `
                attribute vec2 a_position;
                attribute vec2 a_texCoord;
                
                uniform mat3 u_transform;
                uniform vec2 u_resolution;
                
                varying vec2 v_texCoord;
                
                void main() {
                    // 将位置从像素转换为0.0到1.0
                    vec2 zeroToOne = a_position / u_resolution;
                    
                    // 转换坐标
                    vec3 transformed = u_transform * vec3(zeroToOne, 1);
                    
                    // 从0->1转换为-1->1（WebGL的坐标系统）
                    vec2 clipSpace = (zeroToOne * 2.0) - 1.0;
                    
                    // 转换后的坐标
                    clipSpace = (transformed.xy * 2.0) - 1.0;
                    
                    // 调整y轴方向（WebGL的纹理坐标系统是倒置的）
                    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                    
                    // 传递纹理坐标到片段着色器
                    v_texCoord = a_texCoord;
                }
            `;
    // 片段着色器
    const fragmentShaderSource = `
                precision mediump float;
                
                uniform sampler2D u_image;
                uniform float u_brightness;
                uniform float u_contrast;
                
                varying vec2 v_texCoord;
                
                void main() {
                    // 从纹理获取颜色
                    vec4 color = texture2D(u_image, v_texCoord);
                    
                    // 应用亮度
                    color.rgb = color.rgb * u_brightness;
                    
                    // 应用对比度
                    color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
                    
                    gl_FragColor = color;
                }
            `;
    // 创建着色器程序
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    program = createProgram(gl, vertexShader, fragmentShader);
    // 使用着色器程序
    gl.useProgram(program);
    // 获取属性和制服的位置
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const transformLocation = gl.getUniformLocation(program, 'u_transform');
    const imageLocation = gl.getUniformLocation(program, 'u_image');
    const brightnessLocation = gl.getUniformLocation(program, 'u_brightness');
    const contrastLocation = gl.getUniformLocation(program, 'u_contrast');
    // 创建缓冲区
    const positionBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();

    // 设置位置缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    setRectangle(gl, 0, 0, glCanvas.width, glCanvas.height);

    // 启用并设置位置属性
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // 设置纹理坐标缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            0.0,  0.0,
            1.0,  0.0,
            0.0,  1.0,
            0.0,  1.0,
            1.0,  0.0,
            1.0,  1.0
        ]),
        gl.STATIC_DRAW
    );

    // 启用并设置纹理坐标属性
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // 设置分辨率制服
    gl.uniform2f(resolutionLocation, glCanvas.width, glCanvas.height);

    // 设置纹理单元
    gl.uniform1i(imageLocation, 0);

    // 保存制服位置
    program.transformLocation = transformLocation;
    program.brightnessLocation = brightnessLocation;
    program.contrastLocation = contrastLocation;
}

// 创建着色器
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
}

// 创建着色器程序
function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
}

// 设置矩形顶点数据
function setRectangle(gl, x, y, width, height) {
    const x1 = x;
    const x2 = x + width;
    const y1 = y;
    const y2 = y + height;

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            x1, y1,
            x2, y1,
            x1, y2,
            x1, y2,
            x2, y1,
            x2, y2
        ]),
        gl.STATIC_DRAW
    );
}

// 加载图片
function loadImage(file) {
    showLoading(true);

    // 检查文件类型
    if (!file.type.match('image.*')) {
        alert('请选择图片文件！');
        showLoading(false);
        return;
    }

    // 更新图片信息
    fileName.textContent = file.name;
    imageSize.textContent = `${file.size / 1024 | 0} KB`;
    imageFormat.textContent = file.type.split('/')[1].toUpperCase();
    imageInfo.classList.remove('hidden');

    // 创建图片对象
    image = new Image();
    image.onload = function() {
        // 调整canvas大小以匹配图片比例
        adjustCanvasSize();

        // 创建纹理
        createTexture();

        // 更新变换
        updateTransform();

        // 隐藏加载指示器
        showLoading(false);

        // 隐藏无图片消息
        noImageMessage.classList.add('hidden');
    };
    image.onerror = function() {
        alert('图片加载失败！');
        showLoading(false);
    };
    image.src = URL.createObjectURL(file);
}

// 调整Canvas大小
function adjustCanvasSize() {
    if (!image) return;

    // 获取容器尺寸
    const container = document.getElementById('previewContainer');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight || 400;

    // 计算图片宽高比
    const imageAspectRatio = image.width / image.height;
    const containerAspectRatio = containerWidth / containerHeight;

    // 根据宽高比确定Canvas尺寸
    let canvasWidth, canvasHeight;
    if (containerAspectRatio > imageAspectRatio) {
        // 容器更宽，以高度为基准
        canvasHeight = containerHeight;
        canvasWidth = canvasHeight * imageAspectRatio;
    } else {
        // 容器更高，以宽度为基准
        canvasWidth = containerWidth;
        canvasHeight = canvasWidth / imageAspectRatio;
    }

    // 设置Canvas尺寸
    glCanvas.width = canvasWidth;
    glCanvas.height = canvasHeight;

    // 更新WebGL视口
    if (gl) {
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);

        // 更新分辨率制服
        const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
        gl.uniform2f(resolutionLocation, glCanvas.width, glCanvas.height);
    }
}

// 创建纹理
function createTexture() {
    if (!gl || !image) return;

    // 创建纹理对象
    if (!texture) {
        texture = gl.createTexture();
    }

    // 绑定纹理
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // 设置纹理参数
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 将图片上传到纹理
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // 绘制
    draw();
}

// 绘制
function draw() {
    if (!gl || !image) return;

    // 清除画布
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 如果没有图片，直接返回
    if (!texture) return;

    // 绑定纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // 设置变换矩阵
    const transformMatrix = getTransformMatrix();
    gl.uniformMatrix3fv(program.transformLocation, false, transformMatrix);

    // 设置亮度和对比度
    gl.uniform1f(program.brightnessLocation, currentTransform.brightness);
    gl.uniform1f(program.contrastLocation, currentTransform.contrast);

    // 绘制矩形
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// 获取变换矩阵
function getTransformMatrix() {
    if (!image) return;

    // 计算图片在Canvas中的位置和大小
    const imageAspectRatio = image.width / image.height;
    const canvasAspectRatio = glCanvas.width / glCanvas.height;

    let scaleX, scaleY;
    if (canvasAspectRatio > imageAspectRatio) {
        scaleY = 1;
        scaleX = imageAspectRatio / canvasAspectRatio;
    } else {
        scaleX = 1;
        scaleY = canvasAspectRatio / imageAspectRatio;
    }

    // 应用用户调整的缩放
    scaleX *= currentTransform.scale;
    scaleY *= currentTransform.scale;

    // 创建变换矩阵
    const angleInRadians = currentTransform.rotation * Math.PI / 180;
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);

    // 平移到中心，旋转，缩放，然后移回
    return [
        c * scaleX, s * scaleX, 0,
        -s * scaleY, c * scaleY, 0,
        0.5, 0.5, 1
    ];
}

// 更新变换
function updateTransform() {
    // 更新UI显示
    rotationValue.textContent = `${currentTransform.rotation}°`;
    scaleValue.textContent = `${currentTransform.scale.toFixed(1)}x`;
    brightnessValue.textContent = currentTransform.brightness.toFixed(2);
    contrastValue.textContent = currentTransform.contrast.toFixed(2);

    // 绘制
    draw();
}

// 显示/隐藏加载指示器
function showLoading(show) {
    loadingIndicator.style.opacity = show ? '1' : '0';
    loadingIndicator.style.pointerEvents = show ? 'auto' : 'none';
}

// 下载处理后的图片
function downloadImage() {
    if (!image) return;

    try {
        // 创建下载链接
        const link = document.createElement('a');
        link.download = `processed_${fileName.textContent}`;
        link.href = glCanvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        console.error('下载图片失败:', e);
        alert('下载图片失败，请重试。');
    }
}

// 重置所有参数
function resetParameters() {
    currentTransform = {
        rotation: 0,
        scale: 1,
        brightness: 1,
        contrast: 1
    };

    // 更新滑块
    rotationSlider.value = currentTransform.rotation;
    scaleSlider.value = currentTransform.scale;
    brightnessSlider.value = currentTransform.brightness;
    contrastSlider.value = currentTransform.contrast;

    // 更新显示
    updateTransform();
}

// 初始化事件监听
function initEventListeners() {
    // 菜单切换
    menuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    // 滚动效果
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navbar.classList.add('shadow-md', 'py-2');
            navbar.classList.remove('py-3');
        } else {
            navbar.classList.remove('shadow-md', 'py-2');
            navbar.classList.add('py-3');
        }
    });

    // 图片上传
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadImage(e.target.files[0]);
        }
    });

    // 拖放功能
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary', 'bg-primary/5');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-primary', 'bg-primary/5');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-primary/5');

        if (e.dataTransfer.files.length > 0) {
            loadImage(e.dataTransfer.files[0]);
        }
    });

    // 变换控制
    rotationSlider.addEventListener('input', (e) => {
        currentTransform.rotation = parseInt(e.target.value);
        updateTransform();
    });

    scaleSlider.addEventListener('input', (e) => {
        currentTransform.scale = parseFloat(e.target.value);
        updateTransform();
    });

    brightnessSlider.addEventListener('input', (e) => {
        currentTransform.brightness = parseFloat(e.target.value);
        updateTransform();
    });

    contrastSlider.addEventListener('input', (e) => {
        currentTransform.contrast = parseFloat(e.target.value);
        updateTransform();
    });

    // 重置按钮
    resetBtn.addEventListener('click', resetParameters);

    // 下载按钮
    downloadBtn.addEventListener('click', downloadImage);

    // 窗口大小调整
    window.addEventListener('resize', () => {
        if (image) {
            adjustCanvasSize();
            draw();
        }
    });
}

// 初始化应用
function init() {
    initWebGL();
    initEventListeners();
}

// 页面加载完成后初始化
window.addEventListener('load', init);