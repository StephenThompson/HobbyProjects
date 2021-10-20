import * as THREE from '../js/three.module.js';
// import {
// 	FileLoader,
// 	Loader,
// 	Texture
// } from "../js/three.module.js";

class Ocean extends THREE.Mesh {

	constructor( geometry, options = {} ) {

		super( geometry );

		const scope = this;

		var sunDirection = new THREE.Vector3(1, 1, 1).normalize();
		const textureLoader = new THREE.TextureLoader();

		const texture = textureLoader.load('../images/foamSeamless.jpg'); 
		// const texture = textureLoader.load('https://threejsfundamentals.org/threejs/resources/images/wall.jpg');
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
					'_texNormal': { value: texture },
					'_Color': { value: new THREE.Vector3( 0.12, 0.30, 0.52 ) },
					'_SubsurfaceShallowColor': { value:  new THREE.Vector3( 0.08,  0.64, 0.61 ) },
					'_SubsurfaceDeepColor': { value: new THREE.Vector3( 0.11, 0.16, 0.23 ) },
					'_CameraPos': { value: new THREE.Vector3() },
					'_SunDirection': { value: new THREE.Vector3(1, 1, 1).normalize() }
				}
			]),			

			vertexShader:
			 /* glsl */`
			uniform float time;

			varying vec3 vWorldPos;
			varying mat3 vNormal;
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

			// float approxSin(float x)
			// {
			// 	float x2 = x*x;
			// 	float t1 = x * x2;
			// 	float t2 = x * t1;
			// 	float t3 = x * t2;
			// 	float t4 = x * t3;
			// 	float t5 = x * t4;
			// 	return x - t1/6 + t2/
			// }
			
			void main()
			{
				vec3 pos = position.xzy;
				vec3 normal = vec3(0.0, 0.0, 0.0);
				vec3 binormal = vec3(0.0, 0.0, 0.0);
				vec3 tangent = vec3(0.0, 0.0, 0.0);
				float foam = 1.0;
			
				vec3 waves[5] = vec3[5](
					vec3(0.5, 0.4, 0.0), // wavelength, amplitude, dirX, dirZ
					vec3(0.15, 0.04, 17.0),
					vec3(0.3, 0.01, 10.0),
					vec3(0.5, 0.4, 50.0),
					vec3(0.2, 0.01, -20.0)
				);
			
				for (int i = 0; i < 5; i++) {
					float wavelength = waves[i].x;
					float amplitude = waves[i].y * 0.1;
					vec2 direction = degreeToVector( waves[i].z );

					float s = 20.0 * wavelength; // speed
					float w = 2.0 / wavelength; // frequency
					float phi = s * w;
					float QA = 0.03; // sharpness
					float wa = w * 10.0 * amplitude;
			
					float dotTime = clampTo2PI(w * dot(direction, 0.75 * pos.xz) + time * phi);
					float cosXZ = cos(dotTime);
					float sinY = sin(dotTime);
			
					pos += vec3(QA * direction.x * cosXZ, amplitude * sinY, QA * direction.y * cosXZ);
					normal += vec3(-direction.x * wa * cosXZ, 1.0 - QA * wa * sinY, -direction.y * wa * cosXZ);

					binormal += vec3(QA * -direction.x * direction.x * wa * sinY, direction.x * wa * cosXZ, QA * -direction.x * direction.y * wa * sinY);
					tangent += vec3(-direction.x * QA * direction.y * wa * sinY, direction.y * wa * cosXZ, QA * -direction.y * direction.y * wa * sinY);

					// normal += vec3(-direction.x * wa * cosXZ, 1.0 - QA * wa * sinY, -direction.y * wa * cosXZ);
					// normal += normalize(vec3(-direction.x * wa * cosXZ, 1.0 - QA * wa * sinY, -direction.y * wa * cosXZ));
					foam *= 0.505 * (clamp(sinY * 0.15 + 1.0, 0.0, 1.0) + clamp(cosXZ * 0.15 + 1.0, 0.0, 1.0));
				}
			
				vec4 mvPosition = modelViewMatrix * vec4( pos.xzy, 1.0 );
				gl_Position = projectionMatrix * mvPosition;

				binormal.x = 1.0 + binormal.x; 
				tangent.z = 1.0 + tangent.z; 

				normal = normalize(normal).xzy;
				binormal = normalize(binormal).xzy;
				tangent = normalize(tangent).xzy;

				// vNormal = mat3( 
				// 	tangent.x, binormal.x, normal.x,
				// 	tangent.y, binormal.y, normal.y,
				// 	tangent.z, binormal.z, normal.z 
				// );

				vNormal = mat3( 
					binormal.x, binormal.y, binormal.z,
					tangent.x, tangent.y, tangent.z,
					normal.x, normal.y, normal.z 
				);

				// vNormal = mat3( binormal, tangent, normal);
				// 	tangent.x, binormal.x, normal.x,
				// 	tangent.y, binormal.y, normal.y,
				// 	tangent.z, binormal.z, normal.z 
				// );

				vFoam = foam;
				uv_Foam = position.xy * 0.5;
				vWorldPos = (modelMatrix * vec4( pos.xzy, 1.0 )).xyz;
			}
			`
			,

			fragmentShader: 
			/* glsl */`
		
			uniform sampler2D _texFoam;
			uniform sampler2D _texNormal;
			uniform float time;
			uniform vec3 _Color;
			uniform vec3 _SubsurfaceDeepColor;
			uniform vec3 _SubsurfaceShallowColor;
			uniform vec3 _CameraPos;
			uniform vec3 _SunDirection;


			varying vec3 vWorldPos;
			varying mat3 vNormal;
			varying float vFoam;
			varying vec2 uv_Foam;

			float map(float s, float a1, float a2, float b1, float b2)
			{
				return b1 + (s - a1)*(b2 - b1) / (a2 - a1);
			}

			float calculateFresnel(vec3 v, vec3 h)
			{
				float f0 = 0.8;
				float vdoth = dot(v, h);
				return f0 + (1.0-f0) * pow(2.0, (-5.55473*vdoth - 6.98316) * vdoth); 
			}

			void main( void ) {
				vec3 subsurfaceShallowColor = _SubsurfaceShallowColor * 2.0;
				// Normal
				vec2 bumpUV_1 = vec2(uv_Foam.x - time * 3.0, uv_Foam.y) * 2.0;
				vec2 bumpUV_2 = vec2(uv_Foam.x - time * 2.0 + 0.33, uv_Foam.y + time) * 4.0;
				vec3 detail = (texture2D(_texNormal, bumpUV_1).rgb + texture2D(_texNormal, bumpUV_2).rgb) * 0.5;
				vec3 normalMapNormalized = detail * 2.0 - 1.0;
				vec3 surfaceNormal = normalize( vNormal[2].xzy);
				// 	vec3(dot(detail, vNormal[0]), dot(detail, vNormal[1]), dot(detail, vNormal[2]))
				// ).xyz;

				// vec3 surfaceNormal = normalize( normalMapNormalized);

				// o.Normal = UnpackNormal(lerp(float4(0.5, 0.5, 0.5, 0.5), detail, _Bumpiness));

				vec3 _WorldSpaceLightPos0 = _SunDirection;
				// vec3 _WorldSpaceLightPos0 = normalize( vec3(1.0,1.0,1.0));
				float ldotn = max(dot(surfaceNormal, _WorldSpaceLightPos0)*0.5 + 0.5, 0.5);

				// Color
				vec3 f1 = texture2D(_texFoam, vec2(uv_Foam.x + time * 4.0, uv_Foam.y) * 1.0).rgb;
				vec3 f2 = texture2D(_texFoam, vec2(uv_Foam.x + time * 3.0 + 0.45, uv_Foam.y + time * 0.25)).rgb;
				vec3 f = (f1 + f2) * 0.5;
				float foamAmount = (f.r + f.g + f.b) * vFoam / 3.0;
				// foamAmount = (1.0-foamAmount) * foamAmount;
				foamAmount = clamp(map(foamAmount, 1.0 - foamAmount, 1.0, 0.0, 1.0), 0.0, 1.0);

				vec4 col = vec4(0.0, 1.0, 1.0, 1.0);
				col.rgb = mix(col.rgb, f.rgb, foamAmount) * ldotn;
				// col.rgb = mix(col.rgb, vec3(1.0, 1.0, 1.0), vFoam) * ldotn;
				// vec4 f3 = texture2D(_texFoam, vec2(0, 0));


				vec3 worldViewDir = normalize(_CameraPos - vWorldPos);
				float subsurface = clamp(dot(worldViewDir, -surfaceNormal) - 0.1, 0.0, 1.0) * (1.0 - foamAmount);
				// float depth = clamp((worldViewDir.y * 3.0 + 0.15), 0.0, 1.0);
				float depth = clamp((sqrt(worldViewDir.y) * 1.0 + 0.05), 0.0, 1.0);
				vec3 c = mix( _Color, mix(_SubsurfaceDeepColor, subsurfaceShallowColor, 1.0 - depth), subsurface) * ldotn;
				
				float sunPower = 0.5 * pow(clamp(dot(_WorldSpaceLightPos0, worldViewDir), 0.0, 1.0), 5.0);
				vec3 Emission = mix(_Color* ldotn, mix(_SubsurfaceDeepColor, subsurfaceShallowColor, 1.0 - depth), clamp(subsurface + sunPower, 0.0, 1.0))
					* clamp(clamp(_WorldSpaceLightPos0.y + 0.5, 0.0, 1.0) * (1.0 - foamAmount * 0.1) + sunPower, 0.0, 1.0);

				c = mix(vec3(0.0, 0.0, 0.0), f * ldotn, foamAmount); 
				c += Emission;// * (1.0-foamAmount*0.1);
				vec3 halfview = normalize(worldViewDir + _WorldSpaceLightPos0);
				c += pow(max(0.0, dot(halfview, surfaceNormal)), 20.0) * vec3(0.5, 0.8, 1.0) * 0.2;


				// fresnel
				// vec3 hn = normalize(surfaceNormal + worldViewDir);
				// float fresnel = calculateFresnel(worldViewDir, hn);
				// c = mix(c, vec3(1,1,1), 1.0-fresnel);


				// c = mix(c, vec3(1.0, 1.0, 1.0), vFoam -0.5) * ldotn; 
				gl_FragColor = vec4(c, 1);
				// gl_FragColor = vec4(vNormal[0] * 0.5 + 0.5, 1);
			}`

		};

		const material = new THREE.ShaderMaterial( {
			fragmentShader: mirrorShader.fragmentShader,
			vertexShader: mirrorShader.vertexShader,
			uniforms: THREE.UniformsUtils.clone( mirrorShader.uniforms ),
			lights: true
		} );

		const normalMap = textureLoader.load('../images/waterSurface.jpg'); 
		// const texture = textureLoader.load('https://threejsfundamentals.org/threejs/resources/images/wall.jpg');
		normalMap.wrapS = THREE.RepeatWrapping;
		normalMap.wrapT = THREE.RepeatWrapping;
		normalMap.magFilter = THREE.NearestFilter;

		material.uniforms[ '_CameraPos' ].value = cameraWorldPosition;
		material.uniforms[ '_texFoam' ].value = texture;
		material.uniforms[ '_texNormal' ].value = normalMap;
		material.uniforms[ '_SunDirection' ].value = sunDirection;
		scope.material = material;

		let clock = new THREE.Clock();
		scope.onBeforeRender = function ( renderer, scene, camera ) {
		// function animate(){
			const delta = clock.getDelta();
			material.uniforms[ 'time' ].value += 0.05 * delta;
			
			cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );
		}
	}


	
}

export { Ocean };
// Water.prototype.isWater = true;