import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";

export class EffectsSystem {
    constructor() {
        this.viewerCore = null;
        this.mesh = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Effect parameters
        this.effectParams = {
            effect: "None",
            intensity: 0.8
        };
        
        // Animation time
        this.animateT = dyno.dynoFloat(0);
        
        // Effect state
        this.isActive = false;
        this.lastUpdateTime = 0;
        this.updateInterval = 100; // ms between updates
    }

    setViewerCore(viewerCore) {
        this.viewerCore = viewerCore;
        this.mesh = viewerCore.mesh;
        this.scene = viewerCore.scene;
        this.camera = viewerCore.camera;
        this.renderer = viewerCore.renderer;
    }

    init() {
        console.log('Initializing Effects System...');
        
        // Initialize with no effect
        this.setEffectType("None");
        this.setIntensity(0.8);
        
        console.log('Effects System initialized');
    }

    // Main effect control methods
    setEffectType(effectType) {
        console.log('Setting effect type:', effectType);
        
        this.effectParams.effect = effectType;
        this.isActive = effectType !== "None";
        
        if (this.mesh) {
            if (this.isActive) {
                // Apply effect modifier
                this.mesh.objectModifier = this.createEffectModifier();
            } else {
                // Remove effects
                this.mesh.objectModifier = null;
            }
            this.mesh.updateGenerator();
        }
        
        console.log('Effect applied:', effectType, 'Active:', this.isActive);
    }

    setIntensity(intensity) {
        this.effectParams.intensity = intensity;
        console.log('Effect intensity set to:', intensity, this.isActive && this.mesh);
        if (this.isActive && this.mesh) {
            console.log('1111111Effect intensity set to:', intensity);

            this.mesh.objectModifier = this.createEffectModifier();
            this.mesh.updateGenerator();
        }
    }

    // Update function called in animation loop
    update() {
        if (!this.isActive || !this.mesh) return;
        
        const currentTime = Date.now();
        if (currentTime - this.lastUpdateTime > this.updateInterval) {
            this.animateT.value = performance.now() / 1000;
            this.mesh.updateVersion();
            this.lastUpdateTime = currentTime;
        }
    }

    // Reset effects
    reset() {
        console.log('Resetting effects');
        this.setEffectType("None");
        this.setIntensity(0.8);
    }

    // Effect modifier creation
    createEffectModifier() {
        return dyno.dynoBlock(
            { gsplat: dyno.Gsplat },
            { gsplat: dyno.Gsplat },
            ({ gsplat }) => {
                const d = new dyno.Dyno({
                    inTypes: { 
                        gsplat: dyno.Gsplat, 
                        t: "float", 
                        effectType: "int", 
                        intensity: "float",
                        meshCenter: "vec3"
                    },
                    outTypes: { gsplat: dyno.Gsplat },
                    globals: () => [
                        dyno.unindent(`
                            // Utility functions for effects
                            vec3 hash(vec3 p) {
                                return fract(sin(p*123.456)*123.456);
                            }

                            mat2 rot(float a) {
                                float s = sin(a), c = cos(a);
                                return mat2(c, -s, s, c);
                            }

                            // Head movement effect
                            vec3 headMovement(vec3 pos, float t) {
                                vec3 result = pos;
                                result.xy *= rot(smoothstep(-1., -2., pos.y) * .2 * sin(t*2.));
                                return result;
                            }

                            // Breathing animation effect
                            vec3 breathAnimation(vec3 pos, float t) {
                                vec3 result = pos;
                                float b = sin(t*1.5);
                                result.yz *= rot(smoothstep(-1., -3., pos.y) * .15 * -b);
                                result.z += .3;
                                result.y += 1.2;
                                result *= 1. + exp(-3. * length(pos)) * b;
                                result.z -= .3;
                                result.y -= 1.2;
                                return result;
                            }

                            // Electronic fractal effect
                            vec4 fractal1(vec3 pos, float t, float intensity) {
                                float m = 100.;
                                vec3 p = pos * .1;
                                p.y += .5;
                                for (int i = 0; i < 8; i++) {
                                    p = abs(p) / clamp(abs(p.x * p.y), 0.3, 3.) - 1.;
                                    p.xy *= rot(radians(90.));
                                    if (i > 1) m = min(m, length(p.xy) + step(.3, fract(p.z * .5 + t * .5 + float(i) * .2)));
                                }
                                m = step(m, 0.5) * 1.3 * intensity;
                                return vec4(-pos.y * .3, 0.5, 0.7, .3) * intensity + m;
                            }

                            // Deep meditation fractal effect
                            vec4 fractal2(vec3 center, vec3 scales, vec4 rgba, float t, float intensity) {
                                vec3 pos = center;
                                float splatSize = length(scales);
                                float pattern = exp(-50. * splatSize);
                                vec3 p = pos * .65;
                                pos.y += 2.;
                                float c = 0.;
                                float l, l2 = length(p);
                                float m = 100.;
                                
                                for (int i = 0; i < 10; i++) {
                                    p.xyz = abs(p.xyz) / dot(p.xyz, p.xyz) - .8;
                                    l = length(p.xyz);
                                    c += exp(-1. * abs(l - l2) * (1. + sin(t * 1.5 + pos.y)));
                                    l2 = length(p.xyz);
                                    m = min(m, length(p.xyz));
                                }
                                
                                c = smoothstep(0.3, 0.5, m + sin(t * 1.5 + pos.y * .5)) + c * .1;              
                                return vec4(vec3(length(rgba.rgb)) * vec3(c, c*c, c*c*c) * intensity, 
                                          rgba.a * exp(-20. * splatSize) * m * intensity);
                            }

                            // Wave effect
                            vec4 sin3D(vec3 p, float t) {
                                float m = exp(-2. * length(sin(p * 5. + t * 3.))) * 5.;
                                return vec4(m) + .3;
                            }

                            // Disintegration effect
                            vec4 disintegrate(vec3 pos, float t, float intensity) {
                                vec3 p = pos + (hash(pos) * 2. - 1.) * intensity;
                                float tt = smoothstep(-1., 0.5, -sin(t + -pos.y * .5));  
                                p.xz *= rot(tt * 2. + p.y * 2. * tt);
                                return vec4(mix(p, pos, tt), tt);
                            }
                            
                            // Flare effect
                            vec4 flare(vec3 pos, float t) {
                                vec3 p = vec3(0., -1.5, 0.);
                                float tt = smoothstep(-1., .5, sin(t + hash(pos).x));  
                                tt = tt * tt;              
                                p.x += sin(t * 2.) * tt;
                                p.z += sin(t * 2.) * tt;
                                p.y += sin(t) * tt;
                                return vec4(mix(pos, p, tt), tt);
                            }

                            // Disco effect - hundreds of light splats
                            vec3 hundredsOfLightSplats(vec3 worldPos, vec3 meshCenter, float t) {
                                // Dark room environment
                                vec3 roomColor = vec3(0.02, 0.02, 0.03);
                                
                                // Disco ball position
                                vec3 discoBallPos = meshCenter;
                                
                                // Calculate distance from disco ball
                                vec3 toPoint = worldPos - discoBallPos;
                                float distToBall = length(toPoint);
                                
                                if (distToBall < 0.001) {
                                    distToBall = 0.001;
                                }
                                
                                vec3 mainLightColor;
                                float colorCycle = mod(t * 0.4, 3.0);
                                if (colorCycle < 1.0) {
                                    mainLightColor = vec3(1.0, 0.2, 0.2);
                                } else if (colorCycle < 2.0) {
                                    mainLightColor = vec3(0.2, 0.2, 1.0);
                                } else {
                                    mainLightColor = vec3(0.2, 1.0, 0.2);
                                }
                                
                                vec3 totalLight = vec3(0.0);
                                float totalSplatIntensity = 0.0;
                                
                                // First layer of orbiting lights
                                for (int i = 0; i < 16; i++) {
                                    for (int j = 0; j < 4; j++) {
                                        int splatIndex = i * 4 + j;
                                        
                                        float baseAngle = float(i) * 0.3927;
                                        float layerRadius = 0.5 + float(j) * 0.8;
                                        float rotationSpeed = 0.8;
                                        float currentAngle = baseAngle + t * rotationSpeed;
                                        
                                        vec3 splatOrbitPos = vec3(
                                            cos(currentAngle) * layerRadius,
                                            sin(currentAngle) * 0.3,
                                            sin(currentAngle) * layerRadius
                                        );
                                        
                                        vec3 splatWorldPos = discoBallPos + splatOrbitPos;
                                        vec3 splatToPoint = worldPos - splatWorldPos;
                                        float splatDistance = length(splatToPoint);
                                        
                                        if (splatDistance < 0.001) {
                                            splatDistance = 0.001;
                                        }
                                        
                                        float splatSize = 0.15 + hash(vec3(float(splatIndex))).x * 0.1;
                                        float splatIntensity = 1.0 - smoothstep(0.0, splatSize, splatDistance);
                                        splatIntensity *= 2.5;
                                        
                                        vec3 splatColor = mainLightColor;
                                        splatColor += hash(vec3(float(splatIndex), 1.0, 0.0)) * 0.4 - 0.2;
                                        splatColor = max(splatColor, vec3(0.3));
                                        
                                        float pulse = 0.7 + 0.3 * sin(t * 3.0 + float(splatIndex) * 0.5);
                                        splatIntensity *= pulse;
                                        
                                        totalLight += splatColor * splatIntensity;
                                        totalSplatIntensity += splatIntensity;
                                    }
                                }
                                
                                // Second layer of orbiting lights
                                for (int k = 0; k < 12; k++) {
                                    for (int l = 0; l < 4; l++) {
                                        int splatIndex = 64 + k * 4 + l;
                                        
                                        float baseAngle = float(k) * 0.5236;
                                        float layerRadius = 2.0 + float(l) * 1.2;
                                        float rotationSpeed = 0.6;
                                        float currentAngle = baseAngle + t * rotationSpeed * 1.3;
                                        
                                        vec3 splatOrbitPos = vec3(
                                            cos(currentAngle) * layerRadius,
                                            (hash(vec3(float(k), float(l), 0.0)).x - 0.5) * 3.0,
                                            sin(currentAngle) * layerRadius
                                        );
                                        
                                        vec3 splatWorldPos = discoBallPos + splatOrbitPos;
                                        vec3 splatToPoint = worldPos - splatWorldPos;
                                        float splatDistance = length(splatToPoint);
                                        
                                        if (splatDistance < 0.001) {
                                            splatDistance = 0.001;
                                        }
                                        
                                        float splatSize = 0.12 + hash(vec3(float(splatIndex))).x * 0.08;
                                        float splatIntensity = 1.0 - smoothstep(0.0, splatSize, splatDistance);
                                        splatIntensity *= 3.0;
                                        
                                        vec3 splatColor = mainLightColor;
                                        if (l == 0) splatColor *= vec3(1.0, 0.8, 0.8);
                                        else if (l == 1) splatColor *= vec3(0.8, 0.8, 1.0);
                                        else if (l == 2) splatColor *= vec3(0.8, 1.0, 0.8);
                                        
                                        float pulse = 0.6 + 0.4 * sin(t * 4.0 + float(splatIndex) * 0.7);
                                        splatIntensity *= pulse;
                                        
                                        totalLight += splatColor * splatIntensity;
                                        totalSplatIntensity += splatIntensity;
                                    }
                                }
                                
                                // Random floating lights
                                for (int m = 0; m < 32; m++) {
                                    int splatIndex = 112 + m;
                                    
                                    vec3 randomOffset = hash(vec3(float(m), 2.0, 0.0)) * 8.0 - 4.0;
                                    randomOffset.y = abs(randomOffset.y) * 0.5;
                                    
                                    vec3 drift = vec3(
                                        sin(t * 0.5 + float(m) * 0.3) * 0.5,
                                        cos(t * 0.7 + float(m) * 0.5) * 0.3,
                                        sin(t * 0.6 + float(m) * 0.4) * 0.5
                                    );
                                    
                                    vec3 splatWorldPos = discoBallPos + randomOffset + drift;
                                    vec3 splatToPoint = worldPos - splatWorldPos;
                                    float splatDistance = length(splatToPoint);
                                    
                                    if (splatDistance < 0.001) {
                                        splatDistance = 0.001;
                                    }
                                    
                                    float splatSize = 0.1 + hash(vec3(float(m))).x * 0.05;
                                    float splatIntensity = 1.0 - smoothstep(0.0, splatSize, splatDistance);
                                    splatIntensity *= 4.0;
                                    
                                    vec3 splatColor = mainLightColor;
                                    splatColor = mix(splatColor, hash(vec3(float(m), 3.0, 0.0)), 0.3);
                                    splatColor = max(splatColor, vec3(0.4));
                                    
                                    float blink = step(0.3, hash(vec3(t * 2.0 + float(m))).x);
                                    splatIntensity *= blink;
                                    
                                    totalLight += splatColor * splatIntensity;
                                    totalSplatIntensity += splatIntensity;
                                }
                                
                                vec3 finalColor = roomColor;
                                
                                if (totalSplatIntensity > 0.0) {
                                    vec3 averageSplatColor = totalLight / totalSplatIntensity;
                                    finalColor += averageSplatColor * totalSplatIntensity * 0.3;
                                    
                                    float overallBrightness = totalSplatIntensity * 0.1;
                                    if (overallBrightness > 0.5) {
                                        finalColor += averageSplatColor * (overallBrightness - 0.5) * 2.0;
                                    }
                                }
                                
                                float distanceFalloff = 1.0 / (1.0 + distToBall * 0.3);
                                finalColor *= distanceFalloff;
                                
                                return finalColor;
                            }
                            
                            // Main disco effect function
                            vec4 hundredsOfSplatsEffect(vec3 worldPos, vec4 originalColor, float t, float intensity, vec3 meshCenter) {
                                vec3 lightSplats = hundredsOfLightSplats(worldPos, meshCenter, t);
                                vec3 finalColor = originalColor.rgb * 0.05;
                                finalColor += lightSplats * intensity * 6.0;
                                
                                float splatLuminance = length(lightSplats);
                                if (splatLuminance > 0.1) {
                                    finalColor = mix(finalColor, finalColor * 2.0, splatLuminance);
                                }
                                
                                float splatAlpha = min(1.0, originalColor.a + splatLuminance * 1.2);
                                return vec4(finalColor, splatAlpha);
                            }
                        `)
                    ],
                    statements: ({ inputs, outputs }) => dyno.unindentLines(`
                        ${outputs.gsplat} = ${inputs.gsplat};
                        
                        vec3 localPos = ${inputs.gsplat}.center;
                        vec3 splatScales = ${inputs.gsplat}.scales;
                        vec4 splatColor = ${inputs.gsplat}.rgba;
                        
                        // Effect type mapping:
                        // 1 = Electronic
                        // 2 = Deep Meditation  
                        // 3 = Waves
                        // 4 = Flare
                        // 5 = Disintegrate
                        // 6 = Disco
                        
                        if (${inputs.effectType} == 1) {
                            // Electronic effect
                            vec3 movedPos = headMovement(localPos, ${inputs.t});
                            ${outputs.gsplat}.center = movedPos;
                            vec4 fractalResult = fractal1(localPos, ${inputs.t}, ${inputs.intensity});
                            ${outputs.gsplat}.rgba.rgba = mix(splatColor, splatColor * fractalResult, ${inputs.intensity});
                        } 
                        else if (${inputs.effectType} == 2) {
                            // Deep Meditation effect
                            vec4 effectColor = fractal2(localPos, splatScales, splatColor, ${inputs.t}, ${inputs.intensity});
                            ${outputs.gsplat}.rgba.rgba = mix(splatColor, effectColor, ${inputs.intensity});
                            vec3 animatedPos = breathAnimation(localPos, ${inputs.t});
                            ${outputs.gsplat}.center = animatedPos;
                        } 
                        else if (${inputs.effectType} == 3) {
                            // Waves effect
                            vec4 effect = sin3D(localPos, ${inputs.t});
                            ${outputs.gsplat}.rgba.rgba = mix(splatColor, splatColor * effect, ${inputs.intensity});
                            vec3 pos = localPos;
                            pos.y += 1.;
                            pos *= (1. + effect.x * .05 * ${inputs.intensity});
                            pos.y -= 1.;
                            ${outputs.gsplat}.center = pos;
                        } 
                        else if (${inputs.effectType} == 5) {
                            // Disintegrate effect
                            vec4 e = disintegrate(localPos, ${inputs.t}, ${inputs.intensity});
                            ${outputs.gsplat}.center = e.xyz;
                            ${outputs.gsplat}.scales = mix(vec3(.01, .01, .01), ${inputs.gsplat}.scales, e.w);
                        } 
                        else if (${inputs.effectType} == 4) {
                            // Flare effect
                            vec4 e = flare(localPos, ${inputs.t});
                            ${outputs.gsplat}.center = e.xyz;
                            ${outputs.gsplat}.rgba.rgb = mix(splatColor.rgb, vec3(1.), abs(e.w));
                            ${outputs.gsplat}.rgba.a = mix(splatColor.a, 0.3, abs(e.w));
                        }
                        else if (${inputs.effectType} == 6) {
                            // Disco effect
                            vec4 splats = hundredsOfSplatsEffect(localPos, splatColor, ${inputs.t}, ${inputs.intensity}, ${inputs.meshCenter});
                            ${outputs.gsplat}.rgba = splats;
                        }
                    `),
                });

                const effectTypeMap = {
                    "None": 0,
                    "Electronic": 1,
                    "Deep Meditation": 2,
                    "Waves": 3,
                    "Flare": 4,
                    "Disintegrate": 5,
                    "Disco": 6
                };

                const effectType = effectTypeMap[this.effectParams.effect] || 0;
                
                if (effectType !== 0) {
                    // Get mesh center for effects that need it
                    let meshCenter = new THREE.Vector3(0, 0, 0);
                    if (this.mesh) {
                        const boundingBox = this.mesh.getBoundingBox();
                        boundingBox.getCenter(meshCenter);
                    }
                    console.log("2222222", this.effectParams.intensity)
                    gsplat = d.apply({ 
                        gsplat, 
                        t: this.animateT,
                        effectType: dyno.dynoInt(effectType),
                        intensity: dyno.dynoFloat(this.effectParams.intensity),
                        meshCenter: dyno.dynoVec3(meshCenter)
                    }).gsplat;
                }
                
                return { gsplat };
            }
        );
    }

    // Get current effect state
    getState() {
        return {
            ...this.effectParams,
            isActive: this.isActive
        };
    }

    // Cleanup
    dispose() {
        // Remove any active effects
        this.setEffectType("None");
        
        // Clean up resources
        if (this.mesh && this.mesh.objectModifier) {
            this.mesh.objectModifier = null;
            this.mesh.updateGenerator();
        }
        
        console.log('Effects System disposed');
    }
}

export default EffectsSystem;