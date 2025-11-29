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
    
                            // DISCO WITH BALANCED DARKNESS & GOOD VISIBILITY
                            vec4 discoBalanced(vec3 pos, vec4 rgba, vec3 scales, float t, float intensity, vec3 meshCenter) {
                                vec3 worldPos = pos + meshCenter;
                                
                                float gridDensity = 8.0;
                                vec3 cell = floor(worldPos * gridDensity);
                                
                                // Orbit parameters
                                float orbitRadius = 0.15;
                                float orbitSpeed1 = 1.5;
                                float orbitSpeed2 = 2.2;
                                
                                // Calculate circular orbits
                                vec2 orbit1 = vec2(
                                    sin(t * orbitSpeed1 + cell.x * 2.0) * orbitRadius,
                                    cos(t * orbitSpeed1 + cell.z * 1.5) * orbitRadius
                                );
                                
                                vec2 orbit2 = vec2(
                                    cos(t * orbitSpeed2 + cell.y * 1.8) * orbitRadius * 0.7,
                                    sin(t * orbitSpeed2 + cell.x * 2.3) * orbitRadius * 0.7
                                );
                                
                                // Moving spot centers
                                vec3 baseCellCenter = (cell + 0.5) / gridDensity;
                                vec3 movingCenter1 = baseCellCenter;
                                movingCenter1.xz += orbit1;
                                
                                vec3 movingCenter2 = baseCellCenter;
                                movingCenter2.xz += orbit2;
                                
                                // Calculate distances to orbiting spots
                                float dist1 = length(worldPos - movingCenter1);
                                float dist2 = length(worldPos - movingCenter2);
                                float spotRadius = 0.04;
                                
                                // Circular spots with smooth edges
                                float spot1 = 1.0 - smoothstep(0.0, spotRadius, dist1);
                                float spot2 = 1.0 - smoothstep(0.0, spotRadius, dist2);
                                
                                // Colors for each orbit
                                vec3 color1, color2;
                                float colorIndex1 = mod(cell.x * 1.2 + cell.z * 2.4 + t * 0.4, 6.0);
                                float colorIndex2 = mod(cell.y * 2.1 + cell.x * 1.7 + t * 0.6, 6.0);
                                
                                if (colorIndex1 < 1.0) color1 = vec3(1.0, 0.0, 0.0);
                                else if (colorIndex1 < 2.0) color1 = vec3(0.0, 1.0, 0.0);
                                else if (colorIndex1 < 3.0) color1 = vec3(0.0, 0.0, 1.0);
                                else if (colorIndex1 < 4.0) color1 = vec3(1.0, 1.0, 0.0);
                                else if (colorIndex1 < 5.0) color1 = vec3(1.0, 0.0, 1.0);
                                else color1 = vec3(0.0, 1.0, 1.0);
                                
                                if (colorIndex2 < 1.0) color2 = vec3(1.0, 0.5, 0.0);
                                else if (colorIndex2 < 2.0) color2 = vec3(0.5, 1.0, 0.0);
                                else if (colorIndex2 < 3.0) color2 = vec3(0.0, 0.5, 1.0);
                                else if (colorIndex2 < 4.0) color2 = vec3(1.0, 1.0, 0.5);
                                else if (colorIndex2 < 5.0) color2 = vec3(1.0, 0.5, 1.0);
                                else color2 = vec3(0.5, 1.0, 1.0);
                                
                                // Pulsing animation
                                float pulse1 = 0.6 + 0.4 * sin(t * 3.0 + cell.x);
                                float pulse2 = 0.6 + 0.4 * sin(t * 3.5 + cell.z);
                                
                                spot1 *= pulse1 * intensity * 2.0;
                                spot2 *= pulse2 * intensity * 2.0;
                                
                                // BALANCED DARK BACKGROUND - not too dark, good visibility
                                vec3 darkBackground = rgba.rgb * 0.4; // 60% darker (was 0.05 - 95% darker)
                                
                                // ILLUMINATION EFFECT - spots light up the surrounding area
                                float glowRadius1 = spotRadius * 3.0;
                                float glowRadius2 = spotRadius * 3.0;
                                
                                // Glow around spots
                                float glow1 = 1.0 - smoothstep(0.0, glowRadius1, dist1);
                                float glow2 = 1.0 - smoothstep(0.0, glowRadius2, dist2);
                                
                                glow1 *= 0.5 * pulse1 * intensity; // Stronger glow
                                glow2 *= 0.5 * pulse2 * intensity;
                                
                                // Combine everything:
                                // 1. Start with balanced dark background
                                vec3 finalColor = darkBackground;
                                
                                // 2. Add glow illumination
                                finalColor += color1 * glow1;
                                finalColor += color2 * glow2;
                                
                                // 3. Add bright spots on top
                                finalColor = mix(finalColor, color1, spot1);
                                finalColor = mix(finalColor, color2, spot2);
                                
                                // Calculate final alpha
                                float illumination = max(glow1, glow2);
                                float spots = max(spot1, spot2);
                                float finalAlpha = max(rgba.a, max(illumination, spots));
                                
                                return vec4(finalColor, finalAlpha);
                            }
    
                            // DISCO BRIGHTER VERSION - Even better visibility
                            vec4 discoBrightVisible(vec3 pos, vec4 rgba, vec3 scales, float t, float intensity, vec3 meshCenter) {
                                vec3 worldPos = pos + meshCenter;
                                
                                float gridDensity = 10.0;
                                vec3 cell = floor(worldPos * gridDensity);
                                
                                // Create multiple orbiting spots
                                vec3 baseCellCenter = (cell + 0.5) / gridDensity;
                                
                                // Three orbiting spots per cell
                                vec3 movingCenters[3];
                                vec3 colors[3];
                                float spots[3];
                                float glows[3];
                                
                                for (int i = 0; i < 3; i++) {
                                    float orbitSpeed = 1.0 + float(i) * 0.8;
                                    float radius = 0.12 + float(i) * 0.04;
                                    
                                    vec2 orbit = vec2(
                                        sin(t * orbitSpeed + cell.x * (1.0 + float(i)) + float(i) * 2.0) * radius,
                                        cos(t * orbitSpeed + cell.z * (1.0 + float(i)) + float(i) * 3.0) * radius
                                    );
                                    
                                    movingCenters[i] = baseCellCenter;
                                    movingCenters[i].xz += orbit;
                                    
                                    float dist = length(worldPos - movingCenters[i]);
                                    float spotRadius = 0.03;
                                    float glowRadius = spotRadius * 4.0;
                                    
                                    spots[i] = 1.0 - smoothstep(0.0, spotRadius, dist);
                                    glows[i] = (1.0 - smoothstep(0.0, glowRadius, dist)) * 0.6; // Brighter glow
                                    
                                    // Color cycling
                                    float colorIndex = mod(cell.x * (1.0 + float(i)) + cell.z * (2.0 + float(i)) + t * (0.2 + float(i) * 0.1), 6.0);
                                    
                                    if (colorIndex < 1.0) colors[i] = vec3(1.0, 0.0, 0.0);
                                    else if (colorIndex < 2.0) colors[i] = vec3(0.0, 1.0, 0.0);
                                    else if (colorIndex < 3.0) colors[i] = vec3(0.0, 0.0, 1.0);
                                    else if (colorIndex < 4.0) colors[i] = vec3(1.0, 1.0, 0.0);
                                    else if (colorIndex < 5.0) colors[i] = vec3(1.0, 0.0, 1.0);
                                    else colors[i] = vec3(0.0, 1.0, 1.0);
                                    
                                    // Pulsing
                                    float pulse = 0.7 + 0.3 * sin(t * (2.0 + float(i)) + cell.x + cell.z);
                                    spots[i] *= pulse * intensity * 2.5; // Brighter spots
                                    glows[i] *= pulse * intensity;
                                }
                                
                                // BALANCED BACKGROUND - good visibility
                                vec3 background = rgba.rgb * 0.6; // Only 40% darker - much brighter
                                
                                vec3 finalColor = background;
                                float maxGlow = 0.0;
                                float maxSpot = 0.0;
                                
                                // Add all glows and spots
                                for (int i = 0; i < 3; i++) {
                                    // Add glow illumination first
                                    finalColor += colors[i] * glows[i];
                                    // Add bright spots on top
                                    finalColor = mix(finalColor, colors[i], spots[i]);
                                    
                                    maxGlow = max(maxGlow, glows[i]);
                                    maxSpot = max(maxSpot, spots[i]);
                                }
                                
                                // Final alpha - ensure illuminated areas are visible
                                float finalAlpha = max(rgba.a, max(maxGlow, maxSpot));
                                
                                return vec4(finalColor, finalAlpha);
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
                            // DISCO EFFECT - Balanced darkness with good visibility
                            // Try the brighter version first:
                            vec4 disco = discoBrightVisible(localPos, splatColor, splatScales, ${inputs.t}, ${inputs.intensity}, ${inputs.meshCenter});
                            
                            ${outputs.gsplat}.rgba = disco;
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
                    let meshCenter = new THREE.Vector3(0, 0, 0);
                    if (this.mesh) {
                        const boundingBox = this.mesh.getBoundingBox();
                        boundingBox.getCenter(meshCenter);
                    }
                    
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