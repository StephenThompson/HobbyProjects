import * as THREE from '../js/three.module.js';

class Ocean extends THREE.Mesh {

	constructor( geometry, options = {} ) {

		super( geometry );

		var sunDirection = new THREE.Vector3(1, 1, 1).normalize();

		const textureLoader = new THREE.TextureLoader();
		const texture = textureLoader.load('../images/foamSeamless.jpg'); 
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.magFilter = THREE.NearestFilter;

		const cameraWorldPosition = new THREE.Vector3();

		const mirrorShader = {
			uniforms: THREE.UniformsUtils.merge([
				THREE.UniformsLib[ 'lights' ],
				{
					'time': { value: 0.0 },
					'_texFoam': { value: texture },
					'_ShallowColor': { value:  new THREE.Vector3( 0.08,  0.64, 0.61 ) },
					'_MiddleColor': { value: new THREE.Vector3( 0.12, 0.30, 0.52 ) },
					'_DeepColor': { value: new THREE.Vector3( 0.11, 0.16, 0.23 ) },
					'_CameraPos': { value: new THREE.Vector3() },
					'_SunDirection': { value: new THREE.Vector3(1, 1, 1).normalize() }
				}
			]),			

			vertexShader: `
			uniform float time;

			varying vec3 vWorldPos;
			varying vec3 vNormal;
			varying float vFoam;
			varying vec2 uv_Foam;
			
			/* Helper Functions */
			float clampTo2PI(float value) {
				return fract(value / 6.28319) * 6.28319;
			}
			
			vec2 degreeToVector(float angle) {
				float radAngle = clampTo2PI(angle * 0.01745);
				return vec2(cos(radAngle), sin(radAngle));
			}

			void main()
			{
				vec3 pos = position.xzy;
				vec3 normal = vec3(0.0, 0.0, 0.0);
				float foam = 1.0;
			
				// The gerstner waves are made from 5 individual hardcoded waves
				vec3 waves[5] = vec3[5](
					vec3(0.5, 0.4, 0.0), // wavelength, amplitude, direction (degree)
					vec3(0.15, 0.04, 17.0),
					vec3(0.3, 0.01, 10.0),
					vec3(0.5, 0.4, 50.0),
					vec3(0.2, 0.01, -20.0)
				);
			
				// Calculate ocean displacement
				for (int i = 0; i < 5; i++) {
					float wavelength = waves[i].x;
					float amplitude = waves[i].y * 0.1;
					vec2 direction = degreeToVector( waves[i].z );

					float waveSpeed = 20.0 * wavelength;
					float waveFreq = 2.0 / wavelength;
					float phi = waveSpeed * waveFreq;

					float QA = 0.03; // sharpness
					float wa = waveFreq * 10.0 * amplitude;
			
					float dotTime = clampTo2PI(waveFreq * dot(direction, 0.75 * pos.xz) + time * phi);
					float cosXZ = cos(dotTime);
					float sinY = sin(dotTime);
			
					pos += vec3(QA * direction.x * cosXZ, amplitude * sinY, QA * direction.y * cosXZ);
					normal += vec3(-direction.x * wa * cosXZ, 1.0 - QA * wa * sinY, -direction.y * wa * cosXZ);

					// foam calculation is rather magic number like, but the general idea is to favor the 
					foam *= 0.5 * (clamp(sinY * 0.15 + 1.0, 0.0, 1.0) + clamp(cosXZ * 0.15 + 1.0, 0.0, 1.0));
				}
			
				// function outputs
				gl_Position = projectionMatrix * modelViewMatrix * vec4( pos.xzy, 1.0 );
				vNormal = normalize(normal);
				vFoam = foam;
				uv_Foam = position.xy * 0.33;
				vWorldPos = (modelMatrix * vec4( pos.xzy, 1.0 )).xyz;
			}
			`
			,

			fragmentShader: `
			uniform sampler2D _texFoam;
			uniform float time;
			uniform vec3 _DeepColor;
			uniform vec3 _MiddleColor;
			uniform vec3 _ShallowColor;
			uniform vec3 _CameraPos;
			uniform vec3 _SunDirection;

			varying vec3 vWorldPos;
			varying vec3 vNormal;
			varying vec2 uv_Foam;
			varying float vFoam;

			float map(float s, float a1, float a2, float b1, float b2)
			{
				return b1 + (s - a1)*(b2 - b1) / (a2 - a1);
			}

			float calculateFresnel(float f0, vec3 v, vec3 h)
			{
				float vdoth = dot(v, h);
				return f0 + (1.0-f0) * pow(1.0 - vdoth, 5.0); 
			}

			void main( void ) {
				vec3 surfaceNormal = normalize(vNormal);
				float ldotn = max(dot(surfaceNormal, _SunDirection)*0.5 + 0.5, 0.5);

				// Foam
				vec3 f1 = texture2D(_texFoam, vec2(uv_Foam.x + time * 4.0, uv_Foam.y) * 1.0).rgb;
				vec3 f2 = texture2D(_texFoam, vec2(uv_Foam.x + time * 3.0 + 0.45, uv_Foam.y + time * 0.25)).rgb;
				vec3 f = (f1 + f2) * 0.5;
				float foamAmount = (f.r + f.g + f.b) * vFoam / 3.0;
				foamAmount = clamp(map(foamAmount, 1.0 - foamAmount, 1.0, 0.0, 1.0), 0.0, 1.0);

				// Color/scattering
				vec3 worldViewDir = normalize(_CameraPos - vWorldPos);
				float subsurface = clamp(dot(worldViewDir, -surfaceNormal) - 0.1, 0.0, 1.0) * (1.0 - foamAmount);
				float depth = clamp((sqrt(worldViewDir.y) * 1.0 + 0.05), 0.0, 1.0);

				vec3 col = mix( _MiddleColor, mix(_DeepColor, _ShallowColor, 1.0 - depth), subsurface) * ldotn;
				col = mix(vec3(0.0, 0.0, 0.0), f * ldotn, foamAmount); 
				
				float sunPower = 0.5 * pow(clamp(abs(dot(_SunDirection, worldViewDir)), 0.0, 1.0), 5.0);
				float colorLerp = clamp(subsurface + sunPower, 0.0, 1.0);
				vec3 Emission = mix(_MiddleColor* ldotn, mix(_DeepColor, _ShallowColor, 1.0 - depth), colorLerp) *
					clamp(clamp(_SunDirection.y + 0.5, 0.0, 1.0) * (1.0 - foamAmount * 0.1) + sunPower, 0.0, 1.0);
				col += Emission;

				// Specular highlight
				vec3 halfview = normalize(worldViewDir + _SunDirection);
				col += pow(max(0.0, dot(halfview, surfaceNormal)), 10.0) * vec3(0.5, 0.8, 1.0) * 0.2;


				vec3 halfNorm = normalize(surfaceNormal + worldViewDir);
				float fresnel = calculateFresnel(0.1, surfaceNormal, worldViewDir) * 0.2;
				col = mix(col, col + vec3(1.0, 1.0, 1.0), fresnel);

				gl_FragColor = vec4(col , 1);
			}`
		};

		const material = new THREE.ShaderMaterial( {
			fragmentShader: mirrorShader.fragmentShader,
			vertexShader: mirrorShader.vertexShader,
			uniforms: THREE.UniformsUtils.clone( mirrorShader.uniforms ),
			lights: true
		} );

		material.uniforms[ '_CameraPos' ].value = cameraWorldPosition;
		material.uniforms[ '_texFoam' ].value = texture;
		material.uniforms[ '_SunDirection' ].value = sunDirection;

		let clock = new THREE.Clock();
		const scope = this;
		scope.material = material;
		scope.onBeforeRender = function ( renderer, scene, camera ) {
			const delta = clock.getDelta();
			material.uniforms[ 'time' ].value += 0.05 * delta;
			cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );
		}
	}
}

export { Ocean };