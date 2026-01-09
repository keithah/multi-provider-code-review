# Contributing to Multi-Provider Code Review

Thank you for your interest in contributing to Multi-Provider Code Review! This document provides guidelines for contributing to the project.

## 🚀 Quick Start

1. **Fork the repository**
   ```bash
   git clone https://github.com/keithah/multi-provider-code-review.git
   cd multi-provider-code-review
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   Follow the existing code style and patterns
   Add tests for new functionality
   Update documentation as needed

4. **Submit a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📋 Development Setup

### Prerequisites

- **Node.js** 18+ with npm
- **Bun** latest version (for TypeScript execution)
- **GitHub CLI** latest version with `gh auth login`

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run type-check

# Format code
npm run format
```

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Manual testing
bun run multi-review-script.ts
```

### Code Quality

```bash
# Linting
npm run lint

# Type checking
npm run type-check
```

## 📝 Documentation

Keep documentation updated with any changes:
- Update README.md with new features
- Add API.md for new options
- Update EXAMPLES.md with new use cases
- Update CHANGELOG.md with version history

## 🤝 Submitting Changes

1. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add your feature"
   git push origin feature/your-feature-name
   ```

2. **Pull Request**
   ```bash
   gh pr create --title "Add: your feature description" --body "Description of your changes and testing results"
   ```

## 📋 Code Review Process

### Review Guidelines

All contributions should maintain:

- **Code Quality**
  - TypeScript strict mode enabled
  - Proper error handling and typing
  - Consistent naming conventions
  - No `any` types in production

- **Testing**
  - Unit tests for all new functionality
  - Integration tests for critical paths
  - Manual testing before submission

- **Documentation**
  - Updated README.md for new features
  - API documentation kept current
  - Examples provided for common use cases

- **Security**
  - No hardcoded secrets
  - Input validation and sanitization
  - Proper error handling
  - No eval() usage

## 🔗 Branching Strategy

- **main**: Stable releases
- **develop**: Development and testing
- **feature/***: Feature branches

## 🏷 Release Process

1. **Version**: Semantic versioning following SemVer
2. **Changelog**: Document all changes in CHANGELOG.md
3. **Tags**: Create Git tags for releases
4. **GitHub Releases**: Use GitHub Releases for distribution

## 📜 Issue Tracking

- Use GitHub Issues for bug reports and feature requests
- Label issues appropriately (bug, enhancement, documentation)
- Reference related issues when applicable

## 🔧 Technical Decisions

### Architecture Principles

1. **Modularity**: Clear separation of concerns
2. **Extensibility**: Easy to add new providers
3. **Testability**: Comprehensive test coverage
4. **Performance**: Parallel processing capabilities
5. **Security**: No hardcoded credentials or logic vulnerabilities

### Current Tech Stack

- **Frontend**: TypeScript, GitHub Actions
- **Backend**: None (pure GitHub Actions workflow)
- **Dependencies**: Minimal, focused on GitHub Actions and CLI tools
- **Testing**: Bun, npm, custom test framework

---

**Happy contributing!** 🎉

For questions or discussions, please open an issue in this repository.