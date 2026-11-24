import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/photo_picker.dart';
import '../../core/widgets/states.dart';
import '../authentication/application/auth_controller.dart';
import '../authentication/presentation/auth_common.dart';
import '../farm_management/farm_providers.dart';
import '../marketplace/market_providers.dart';
import '../marketplace/market_widgets.dart';

final myProductsProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/seller/products'));

/// "Business" tab for suppliers and distributors.
class BusinessScreen extends ConsumerWidget {
  const BusinessScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(authControllerProvider).user!;
    final products = asJsonList(ref.watch(myProductsProvider).value?.data);
    return Scaffold(
      appBar: AppBar(title: const Text('My business')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myProductsProvider.future),
        child: ListView(padding: const EdgeInsets.all(20), children: [
          if (!u.adminVerified)
            const AppCard(color: AppColors.amberSoft, shadow: false, child: Text('Your business is not verified yet. Verified sellers get a badge that buyers trust. An administrator reviews new accounts.')),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: StatTile(label: 'Products', value: '${products.length}', icon: Icons.inventory_outlined)),
            const SizedBox(width: 10),
            Expanded(child: StatTile(label: 'Active', value: '${products.where((p) => p.b('isActive')).length}', icon: Icons.check_circle_outline, tint: AppColors.leafSoft)),
          ]),
          const SizedBox(height: 16),
          for (final (label, icon, route) in [
            ('My products', Icons.inventory_outlined, '/seller/products'),
            ('Add a product', Icons.add_box_outlined, '/seller/products/new'),
            ('Stock / inventory', Icons.inventory_2_outlined, '/inventory'),
            ('Orders from customers', Icons.receipt_long_outlined, '/orders'),
            if (u.isCarrier) ('Delivery requests', Icons.local_shipping_outlined, '/deliveries/open'),
            if (u.isCarrier) ('My deliveries', Icons.route_outlined, '/deliveries'),
            if (u.isCarrier) ('Vehicles', Icons.fire_truck_outlined, '/vehicles'),
          ])
            Padding(padding: const EdgeInsets.only(bottom: 10), child: SecondaryButton(label: label, icon: icon, onPressed: () => context.push(route))),
        ]),
      ),
    );
  }
}

class MyProductsScreen extends ConsumerWidget {
  const MyProductsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PageScaffold(
      title: 'My products',
      fab: FloatingActionButton(backgroundColor: AppColors.coral, foregroundColor: AppColors.white, tooltip: 'Add product', onPressed: () => context.push('/seller/products/new'), child: const Icon(Icons.add)),
      body: CachedListView(
        value: ref.watch(myProductsProvider),
        onRefresh: () => ref.refresh(myProductsProvider.future),
        builder: (raw) {
          final list = asJsonList(raw);
          if (list.isEmpty) return [EmptyView(icon: Icons.inventory_outlined, title: 'No products yet', message: 'Add seed, fertiliser, chemicals or equipment you sell.', actionLabel: 'Add product', onAction: () => context.push('/seller/products/new'))];
          return [
            for (final p in list)
              AppCard(
                margin: const EdgeInsets.only(bottom: 10),
                padding: EdgeInsets.zero,
                onTap: () => context.push('/market/product/${p.s('id')}'),
                child: Row(children: [
                  SizedBox(width: 80, height: 80, child: UploadImage(uploadId: p.sn('imageId'), label: p.s('name'))),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(p.s('name'), style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text('${zmw(p.nn('price'))} / ${unitLabel(p.s('unit'))}'),
                      Text('${p.m('category').s('name')} · ${p.b('isActive') ? 'active' : 'hidden'}', style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
                    ]),
                  ),
                  Switch(
                    value: p.b('isActive'),
                    onChanged: (v) async {
                      try {
                        await ref.read(apiClientProvider).patch('/seller/products/${p.s('id')}', {'isActive': v});
                        ref.invalidate(myProductsProvider);
                      } on ApiException catch (e) {
                        if (context.mounted) showSnack(context, e.message, error: true);
                      }
                    },
                  ),
                ]),
              ),
          ];
        },
      ),
    );
  }
}

class ProductFormScreen extends ConsumerStatefulWidget {
  const ProductFormScreen({super.key});
  @override
  ConsumerState<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends ConsumerState<ProductFormScreen> {
  final _name = TextEditingController();
  final _brand = TextEditingController();
  final _price = TextEditingController();
  final _stock = TextEditingController();
  final _desc = TextEditingController();
  final _safety = TextEditingController();
  final _reg = TextEditingController();
  String? _categoryId;
  String _unit = 'BAG_50KG';
  XFile? _photo;
  bool _busy = false;
  String? _error;
  ApiException? _fe;

  @override
  void dispose() {
    for (final c in [_name, _brand, _price, _stock, _desc, _safety, _reg]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
      _fe = null;
    });
    try {
      final fields = <String, String>{
        'name': _name.text.trim(),
        if (_brand.text.trim().isNotEmpty) 'brand': _brand.text.trim(),
        'categoryId': _categoryId ?? '',
        'price': _price.text.trim(),
        'unit': _unit,
        'stock': _stock.text.trim().isEmpty ? '0' : _stock.text.trim(),
        if (_desc.text.trim().isNotEmpty) 'description': _desc.text.trim(),
        if (_safety.text.trim().isNotEmpty) 'safetyInfo': _safety.text.trim(),
        if (_reg.text.trim().isNotEmpty) 'registrationNumber': _reg.text.trim(),
        'isActive': 'on',
      };
      final form = FormData();
      fields.forEach((k, v) => form.fields.add(MapEntry(k, v)));
      if (_photo != null) form.files.add(MapEntry('image', await photoPart(_photo!)));
      await ref.read(apiClientProvider).multipart('/seller/products', form);
      ref.invalidate(myProductsProvider);
      if (mounted) {
        showSnack(context, 'Product added.');
        context.pop();
      }
    } on ApiException catch (e) {
      setState(() {
        _fe = e;
        _error = e.fieldErrors.isEmpty ? e.message : 'Please check the highlighted fields.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cats = asJsonList(ref.watch(categoriesProvider).value?.data);
    final cat = cats.where((c) => c.s('id') == _categoryId).firstOrNull;
    const gap = SizedBox(height: 14);
    return Scaffold(
      appBar: AppBar(title: const Text('Add product')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          FormErrorBox(_error),
          SecondaryButton(
            label: _photo == null ? 'Add product photo' : 'Photo added ✓ (tap to change)',
            icon: Icons.add_a_photo_outlined,
            onPressed: () async {
              final p = await pickPhoto(context);
              if (p != null) setState(() => _photo = p);
            },
          ),
          gap,
          AppTextField(label: 'Product name', controller: _name, errorText: _fe?.field('name')),
          gap,
          AppTextField(label: 'Brand (optional)', controller: _brand),
          gap,
          AppDropdown<String>(label: 'Category', value: _categoryId, hint: 'Select', items: [for (final c in cats) DropdownMenuItem(value: c.s('id'), child: Text(c.s('name')))], onChanged: (v) => setState(() => _categoryId = v), errorText: _fe?.field('categoryId')),
          gap,
          Row(children: [
            Expanded(child: AppTextField(label: 'Price (ZMW)', controller: _price, keyboardType: const TextInputType.numberWithOptions(decimal: true), errorText: _fe?.field('price'))),
            const SizedBox(width: 12),
            Expanded(child: AppDropdown<String>(label: 'Per', value: _unit, items: [for (final u in quantityUnits) DropdownMenuItem(value: u, child: Text(unitLabel(u)))], onChanged: (v) => setState(() => _unit = v ?? _unit))),
          ]),
          gap,
          AppTextField(label: 'Stock on hand (optional)', controller: _stock, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          gap,
          AppTextField(label: 'Description (optional)', controller: _desc, maxLines: 3),
          if (cat?.b('requiresSafetyInfo') == true) ...[
            gap,
            AppTextField(label: 'Safety information', controller: _safety, maxLines: 3, helper: 'Required for chemicals: PPE, re-entry and pre-harvest intervals.', errorText: _fe?.field('safetyInfo')),
            gap,
            AppTextField(label: 'ZEMA / registration number (optional)', controller: _reg),
          ],
          const SizedBox(height: 22),
          PrimaryButton(label: 'Add product', loading: _busy, onPressed: _save),
        ]),
      ),
    );
  }
}
