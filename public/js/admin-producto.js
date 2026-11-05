(() => {
  const categoria = document.getElementById('idCategoria');
  const nuevoCampo = document.getElementById('nuevo-sabor-campo');
  const nuevoNombre = document.getElementById('nombreCategoriaNueva');
  const archivo = document.getElementById('imagenArchivo');
  const existente = document.getElementById('imagen');
  const preview = document.getElementById('imagen-producto-preview');
  if (!categoria || !archivo) return;
  let objectUrl;
  const actualizarCategoria = () => {
    nuevoCampo.hidden = categoria.value !== 'nueva';
    nuevoNombre.required = !nuevoCampo.hidden;
  };
  const actualizarImagen = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    const imagen = archivo.files[0];
    const src = imagen ? (objectUrl = URL.createObjectURL(imagen)) : existente.selectedOptions[0]?.dataset.src;
    preview.hidden = !src;
    if (src) preview.src = src;
    else preview.removeAttribute('src');
  };
  categoria.addEventListener('change', actualizarCategoria);
  archivo.addEventListener('change', actualizarImagen);
  existente.addEventListener('change', () => {
    archivo.value = '';
    actualizarImagen();
  });
  window.addEventListener('pageshow', () => { actualizarCategoria(); actualizarImagen(); });
  actualizarCategoria();
})();
