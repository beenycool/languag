export class ModelRegistry {
  private registry = new Map<string, ModelMetadata>();

  register(model: ModelMetadata) {
    this.registry.set(model.id, model);
  }

  get(id: string): ModelMetadata | undefined {
    return this.registry.get(id);
  }

  list(): ModelMetadata[] {
    return Array.from(this.registry.values());
  }

  versions(id: string): ModelVersion[] {
    return this.registry.get(id)?.versions || [];
  }
}

interface ModelMetadata {
  id: string;
  framework: 'tensorflow' | 'pytorch' | 'onnx';
  taskType: string;
  hardwareRequirements: string[];
  versions: ModelVersion[];
}

interface ModelVersion {
  version: string;
  precision: 'fp32' | 'fp16' | 'int8';
  optimizedFor: 'cpu' | 'gpu' | 'tpu';
}