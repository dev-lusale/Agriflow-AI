import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Label above a black-outlined field, as in the reference design.
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.keyboardType,
    this.textInputAction,
    this.obscure = false,
    this.validator,
    this.errorText,
    this.maxLines = 1,
    this.minLines,
    this.autofillHints,
    this.onSubmitted,
    this.enabled = true,
    this.helper,
    this.inputFormatters,
    this.suffix,
    this.prefixText,
    this.onChanged,
    this.textCapitalization = TextCapitalization.none,
    this.initialValue,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscure;
  final String? Function(String?)? validator;
  final String? errorText;
  final int maxLines;
  final int? minLines;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onSubmitted;
  final bool enabled;
  final String? helper;
  final List<TextInputFormatter>? inputFormatters;
  final Widget? suffix;
  final String? prefixText;
  final ValueChanged<String>? onChanged;
  final TextCapitalization textCapitalization;
  final String? initialValue;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late bool _hidden = widget.obscure;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w700, fontSize: 14.5, color: AppColors.ink)),
        const SizedBox(height: 8),
        TextFormField(
          controller: widget.controller,
          initialValue: widget.controller == null ? widget.initialValue : null,
          keyboardType: widget.keyboardType,
          textInputAction: widget.textInputAction,
          obscureText: _hidden,
          validator: widget.validator,
          maxLines: widget.obscure ? 1 : widget.maxLines,
          minLines: widget.minLines,
          autofillHints: widget.autofillHints,
          onFieldSubmitted: widget.onSubmitted,
          enabled: widget.enabled,
          inputFormatters: widget.inputFormatters,
          onChanged: widget.onChanged,
          textCapitalization: widget.textCapitalization,
          style: const TextStyle(fontFamily: kFont, fontSize: 16, fontWeight: FontWeight.w500, color: AppColors.ink),
          decoration: InputDecoration(
            hintText: widget.hint,
            errorText: widget.errorText,
            helperText: widget.helper,
            helperMaxLines: 3,
            errorMaxLines: 3,
            prefixText: widget.prefixText,
            suffixIcon: widget.obscure
                ? IconButton(
                    tooltip: _hidden ? 'Show password' : 'Hide password',
                    icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: AppColors.muted),
                    onPressed: () => setState(() => _hidden = !_hidden),
                  )
                : widget.suffix,
          ),
        ),
      ],
    );
  }
}

/// Labelled dropdown with the same outline style.
class AppDropdown<T> extends StatelessWidget {
  const AppDropdown({super.key, required this.label, required this.items, required this.value, required this.onChanged, this.hint, this.validator, this.errorText});
  final String label;
  final List<DropdownMenuItem<T>> items;
  final T? value;
  final ValueChanged<T?>? onChanged;
  final String? hint;
  final String? Function(T?)? validator;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w700, fontSize: 14.5)),
        const SizedBox(height: 8),
        DropdownButtonFormField<T>(
          key: ValueKey('$label-$value-${items.length}'),
          initialValue: value,
          items: items,
          onChanged: onChanged,
          validator: validator,
          isExpanded: true,
          hint: hint == null ? null : Text(hint!, style: const TextStyle(color: AppColors.muted)),
          decoration: InputDecoration(errorText: errorText),
          style: const TextStyle(fontFamily: kFont, fontSize: 16, fontWeight: FontWeight.w500, color: AppColors.ink),
          borderRadius: BorderRadius.circular(kRadius),
          dropdownColor: AppColors.white,
        ),
      ],
    );
  }
}

/// Simple date field that opens the Material date picker.
class AppDateField extends StatelessWidget {
  const AppDateField({super.key, required this.label, required this.value, required this.onChanged, this.firstDate, this.lastDate, this.errorText, this.optional = false});
  final String label;
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final String? errorText;
  final bool optional;

  @override
  Widget build(BuildContext context) {
    final text = value == null ? '' : '${value!.day.toString().padLeft(2, '0')}/${value!.month.toString().padLeft(2, '0')}/${value!.year}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w700, fontSize: 14.5)),
        const SizedBox(height: 8),
        InkWell(
          borderRadius: BorderRadius.circular(kRadius),
          onTap: () async {
            final now = DateTime.now();
            final d = await showDatePicker(
              context: context,
              initialDate: value ?? now,
              firstDate: firstDate ?? DateTime(now.year - 5),
              lastDate: lastDate ?? DateTime(now.year + 3),
            );
            if (d != null) onChanged(d);
          },
          child: InputDecorator(
            decoration: InputDecoration(
              errorText: errorText,
              suffixIcon: value != null && optional
                  ? IconButton(icon: const Icon(Icons.close), tooltip: 'Clear', onPressed: () => onChanged(null))
                  : const Icon(Icons.calendar_today_outlined, color: AppColors.muted),
            ),
            child: Text(text.isEmpty ? 'Choose a date' : text, style: TextStyle(fontFamily: kFont, fontSize: 16, color: text.isEmpty ? AppColors.muted : AppColors.ink)),
          ),
        ),
      ],
    );
  }
}
