# JetBrains IDE Integration Guide

## Plugin Development
1. Create `plugin.xml`:
```xml
<idea-plugin>
  <id>com.example.ourplugin</id>
  <name>Our Integration</name>
  <version>1.0</version>
  <depends>com.intellij.modules.platform</depends>
</idea-plugin>
```

## Project Integration
Key features:
- Project-level configuration
- Module-specific settings
- Tool window integration

## Tool Window Usage
Register tool window in plugin.xml:
```xml
<extensions defaultExtensionNs="com.intellij">
  <toolWindow id="OurTool" anchor="right" 
    factoryClass="com.example.OurToolWindowFactory"/>
</extensions>
```

## Best Practices
- Use IntelliJ SDK annotations
- Follow UI guidelines
- Support light/dark themes