"""Bounded language fallback: fail safely; never silently translate numeric results."""
import re
from app.services.ai.provider import ProviderError

def language_rule(language):
    return ('\nOutput every natural-language field exclusively in Simplified Chinese (zh-CN). Keep SI symbols and numbers unchanged.'
            if language == 'zh-CN' else '\nOutput every natural-language field exclusively in English (en), with no Chinese prose. Keep SI symbols and numbers unchanged.')

def ensure_language(texts, language, allowed_identifiers=()):
    for text in texts:
        if not text:
            continue
        has_han = bool(re.search(r'[\u3400-\u9fff]', text))
        # Preserve existing parameter identifiers and SI symbols, but reject untranslated English prose.
        checked = text
        for identifier in sorted(allowed_identifiers,key=len,reverse=True):
            checked = re.sub(r'(?<![A-Za-z])'+re.escape(identifier)+r'(?![A-Za-z])','',checked)
        foreign_prose = any(word not in {'charge', 'mass', 'field', 'initialVelocity', 'initialPosition', *allowed_identifiers} for word in re.findall(r'[A-Za-z]{4,}', checked))
        if (language == 'en' and has_han) or (language == 'zh-CN' and (not has_han or foreign_prose)):
            raise ProviderError(502, 'language_mismatch', 'The provider did not follow the selected language. Please retry or change the language preference.')
